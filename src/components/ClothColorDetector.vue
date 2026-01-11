<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from "vue";
import {
	PoseLandmarker,
	FilesetResolver,
	DrawingUtils,
	type NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import {
	extractDominantColors,
	type ColorResult,
	type ColorLabel,
} from "../utils/colorClassifier";

// Basic refs
const videoRef = ref<HTMLVideoElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const status = ref("초기화 중...");
const errorMsg = ref("");

const detectedColor = ref<ColorResult | null>(null);
const showDebug = ref(false);

let poseLandmarker: PoseLandmarker | null = null;
let stream: MediaStream | null = null;
let animationId: number | null = null;
let lastVideoTime = -1;

// Persistence & Smoothing
let lastLandmarks: NormalizedLandmark[] | null = null;
let missingFrames = 0;
const MAX_MISSING_FRAMES = 15;

let smoothedRect = { x: 0, y: 0, width: 0, height: 0 };
const SMOOTHING_FACTOR = 0.15; // More stable

const colorLabels: ColorLabel[] = [
	"하늘색",
	"노란색",
	"주황색",
	"빨간색",
	"보라색",
];

const colorStyles = computed(() => ({
	하늘색: { bg: "#87CEEB", text: "#1a5276" },
	노란색: { bg: "#FFD700", text: "#7d6608" },
	주황색: { bg: "#FF8C00", text: "#7e4100" },
	빨간색: { bg: "#DC143C", text: "#ffffff" },
	보라색: { bg: "#8B008B", text: "#ffffff" },
	"알 수 없음": { bg: "#808080", text: "#ffffff" },
}));

async function initSystem() {
	try {
		status.value = "AI 모델 로딩 중...";
		const vision = await FilesetResolver.forVisionTasks(
			"https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
		);

		poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
			baseOptions: {
				modelAssetPath:
					"https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
				delegate: "GPU",
			},
			runningMode: "VIDEO",
			numPoses: 1,
			minPoseDetectionConfidence: 0.3,
			minPosePresenceConfidence: 0.3,
			minTrackingConfidence: 0.3,
		});

		status.value = "카메라 연결 중...";
		stream = await navigator.mediaDevices.getUserMedia({
			video: { width: { ideal: 1280 }, height: { ideal: 720 } },
		});

		if (videoRef.value) {
			videoRef.value.srcObject = stream;
			await videoRef.value.play();
			status.value = "✓ 색상 감지 준비 완료";
			renderLoop();
		}
	} catch (err: any) {
		errorMsg.value = err.message || "오류 발생";
		console.error(err);
	}
}

function smoothRectFn(target: {
	x: number;
	y: number;
	width: number;
	height: number;
}) {
	if (smoothedRect.width === 0) {
		smoothedRect = { ...target };
		return target;
	}
	smoothedRect.x += (target.x - smoothedRect.x) * SMOOTHING_FACTOR;
	smoothedRect.y += (target.y - smoothedRect.y) * SMOOTHING_FACTOR;
	smoothedRect.width += (target.width - smoothedRect.width) * SMOOTHING_FACTOR;
	smoothedRect.height +=
		(target.height - smoothedRect.height) * SMOOTHING_FACTOR;
	return smoothedRect;
}

function renderLoop() {
	const video = videoRef.value;
	const canvas = canvasRef.value;

	if (!video || !canvas || !poseLandmarker) return;

	if (canvas.width !== video.videoWidth) {
		canvas.width = video.videoWidth;
		canvas.height = video.videoHeight;
	}

	const ctx = canvas.getContext("2d", { willReadFrequently: true });
	if (!ctx) return;

	// 1. Draw Video
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

	// 2. Detect
	if (video.currentTime !== lastVideoTime) {
		lastVideoTime = video.currentTime;
		const result = poseLandmarker.detectForVideo(video, performance.now());

		if (result.landmarks && result.landmarks.length > 0) {
			lastLandmarks = result.landmarks[0]!;
			missingFrames = 0;
		} else {
			missingFrames++;
		}
	}

	// 3. Process
	if (lastLandmarks && missingFrames < MAX_MISSING_FRAMES) {
		const isStale = missingFrames > 0;
		const landmarks = lastLandmarks;

		const drawingUtils = new DrawingUtils(ctx);
		drawingUtils.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, {
			color: isStale ? "orange" : "rgba(0, 255, 0, 0.5)",
			lineWidth: 2,
		});

		// --- ROI Calculation: Inner Chest ---
		const lSh = landmarks[11]; // Left Shoulder
		const rSh = landmarks[12]; // Right Shoulder
		const lHip = landmarks[23]; // Left Hip
		const rHip = landmarks[24]; // Right Hip

		if (lSh && rSh && lHip && rHip) {
			// Calculate mid-shoulder point
			const midShoulderX = (lSh.x + rSh.x) / 2;
			const midShoulderY = (lSh.y + rSh.y) / 2;

			// Calculate mid-hip point
			const midHipY = (lHip.y + rHip.y) / 2;

			// Torso dimensions
			const shoulderWidth = Math.abs(lSh.x - rSh.x);
			const torsoHeight = Math.abs(midHipY - midShoulderY);

			// Define a small box in the CENTER of the upper chest
			// We focus on the upper 40% of the torso, starting slightly below neck
			const roiWidth = shoulderWidth * 0.3; // 30% of shoulder width
			const roiHeight = torsoHeight * 0.3; // 30% of torso height

			const centerX = midShoulderX;
			const centerY = midShoulderY + torsoHeight * 0.2; // Shift down 20% from shoulders

			const rectX = centerX - roiWidth / 2;
			const rectY = centerY - roiHeight / 2;

			// Convert to pixel coords
			const targetRect = smoothRectFn({
				x: rectX * canvas.width,
				y: rectY * canvas.height,
				width: roiWidth * canvas.width,
				height: roiHeight * canvas.height,
			});

			// Draw ROI Box
			ctx.strokeStyle = "#00FFFF";
			ctx.lineWidth = 3;
			ctx.strokeRect(
				targetRect.x,
				targetRect.y,
				targetRect.width,
				targetRect.height
			);

			// --- Color Analysis with K-Means ---
			const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

			// Use K-Means to find dominant colors (k=3)
			const dominantColors = extractDominantColors(
				imageData,
				Math.floor(targetRect.x),
				Math.floor(targetRect.y),
				Math.floor(targetRect.width),
				Math.floor(targetRect.height),
				3 // k=3
			);

			// Pick best color
			if (dominantColors.length > 0) {
				// Filter out 'Unknown' if we have other candidates
				const validColors = dominantColors.filter(
					(c) => c.label !== "알 수 없음"
				);

				// Pick confident color
				const bestColor =
					validColors.length > 0
						? validColors.reduce((prev, current) =>
								prev.confidence > current.confidence ? prev : current
						  )
						: dominantColors[0];

				detectedColor.value = bestColor!;

				// Draw result label
				drawFlippedLabel(
					ctx,
					bestColor!,
					targetRect.x,
					targetRect.height + targetRect.y + 10
				);

				// Draw Sample Visualization (Small Circle inside box)
				ctx.fillStyle = `rgb(${bestColor!.rgb.r}, ${bestColor!.rgb.g}, ${
					bestColor!.rgb.b
				})`;
				ctx.beginPath();
				ctx.arc(
					targetRect.x + targetRect.width / 2,
					targetRect.y + targetRect.height / 2,
					8,
					0,
					Math.PI * 2
				);
				ctx.fill();
				ctx.strokeStyle = "white";
				ctx.lineWidth = 2;
				ctx.stroke();
			}
		}

		if (isStale) {
			drawFlippedText(ctx, "신호 보정 중...", canvas.width - 150, 40, "orange");
		}
	} else {
		lastLandmarks = null;
		drawFlippedText(
			ctx,
			"목각인형을 비춰주세요",
			canvas.width / 2,
			canvas.height / 2,
			"white",
			true
		);
	}

	animationId = requestAnimationFrame(renderLoop);
}

function drawFlippedLabel(
	ctx: CanvasRenderingContext2D,
	color: ColorResult,
	x: number,
	y: number
) {
	const style =
		colorStyles.value[color.label] || colorStyles.value["알 수 없음"];

	ctx.save();

	const labelWidth = 140;
	const labelHeight = 50;

	// Boundary check
	if (x < 0) x = 0;
	if (x + labelWidth > ctx.canvas.width) x = ctx.canvas.width - labelWidth;
	if (y + labelHeight > ctx.canvas.height) y = y - labelHeight - 20;

	const centerX = x + labelWidth / 2;
	const centerY = y + labelHeight / 2;

	ctx.translate(centerX, centerY);
	ctx.scale(-1, 1);
	ctx.translate(-centerX, -centerY);

	ctx.fillStyle = style.bg;
	ctx.beginPath();
	ctx.roundRect(x, y, labelWidth, labelHeight, 8);
	ctx.fill();
	ctx.strokeStyle = "white";
	ctx.lineWidth = 2;
	ctx.stroke();

	ctx.fillStyle = style.text;
	ctx.font = "bold 20px Pretendard, Arial";
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.fillText(color.label, centerX, centerY - 8);
	ctx.font = "12px Pretendard, Arial";
	ctx.fillText(
		`${Math.round(color.confidence * 100)}% 정확도`,
		centerX,
		centerY + 12
	);

	ctx.restore();
}

function drawFlippedText(
	ctx: CanvasRenderingContext2D,
	text: string,
	x: number,
	y: number,
	color: string,
	center = false
) {
	ctx.save();
	if (center) {
		ctx.translate(x, y);
		ctx.scale(-1, 1);
		ctx.translate(-x, -y);
		ctx.textAlign = "center";
	} else {
		const estWidth = ctx.measureText(text).width;
		ctx.translate(x + estWidth / 2, y);
		ctx.scale(-1, 1);
		ctx.translate(-(x + estWidth / 2), -y);
	}

	ctx.fillStyle = color;
	ctx.font = "bold 20px Pretendard, sans-serif";
	ctx.fillText(text, x, y);
	ctx.restore();
}

onMounted(() => {
	initSystem();
});

onUnmounted(() => {
	if (animationId) cancelAnimationFrame(animationId);
	if (stream) stream.getTracks().forEach((t) => t.stop());
	if (poseLandmarker) poseLandmarker.close();
});
</script>

<template>
	<div class="detector-container">
		<h1 class="title">🧶 뜨개질 옷 색상 감지기</h1>

		<div class="status-bar">
			<span>{{ status }}</span>
		</div>

		<!-- Error -->
		<div v-if="errorMsg" class="error-banner">
			{{ errorMsg }}
		</div>

		<!-- Video Canvas -->
		<div class="video-container">
			<video ref="videoRef" playsinline muted class="hidden-video"></video>
			<canvas ref="canvasRef" class="mirror-canvas"></canvas>
		</div>

		<!-- Results -->
		<div v-if="detectedColor" class="result-panel">
			<div
				class="main-badge"
				:style="{
					backgroundColor: colorStyles[detectedColor.label]?.bg || '#808080',
					color: colorStyles[detectedColor.label]?.text || '#ffffff',
				}"
			>
				{{ detectedColor.label }}
			</div>

			<!-- Color Legend -->
			<div class="legend-row">
				<span
					v-for="label in colorLabels"
					:key="label"
					class="legend-chip"
					:style="{
						backgroundColor: colorStyles[label].bg,
						color: colorStyles[label].text,
					}"
				>
					{{ label }}
				</span>
			</div>

			<button @click="showDebug = !showDebug" class="debug-toggle">
				{{ showDebug ? "정보 숨기기" : "상세 정보" }}
			</button>

			<!-- Debug -->
			<div v-if="showDebug" class="debug-box">
				<p>
					RGB: {{ detectedColor.rgb.r }}, {{ detectedColor.rgb.g }},
					{{ detectedColor.rgb.b }}
				</p>
				<p>
					HSV: {{ Math.round(detectedColor.hsv.h) }},
					{{ Math.round(detectedColor.hsv.s) }},
					{{ Math.round(detectedColor.hsv.v) }}
				</p>
			</div>
		</div>
	</div>
</template>

<style scoped>
.detector-container {
	max-width: 600px;
	margin: 0 auto;
	padding: 10px;
	font-family: "Pretendard", sans-serif;
	text-align: center;
	color: white;
}

.title {
	margin: 10px 0;
	font-size: 1.5rem;
	text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.status-bar {
	margin-bottom: 10px;
	font-size: 0.95rem;
	color: rgba(255, 255, 255, 0.8);
}

.video-container {
	position: relative;
	width: 100%;
	aspect-ratio: 4/3;
	background: #222;
	border-radius: 16px;
	overflow: hidden;
	box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
	margin-bottom: 20px;
}

.hidden-video {
	display: none;
}

.mirror-canvas {
	width: 100%;
	height: 100%;
	object-fit: contain;
	transform: scaleX(-1); /* Mirror effect */
}

.result-panel {
	background: rgba(255, 255, 255, 0.95);
	border-radius: 20px;
	padding: 20px;
	color: #333;
	box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.1);
}

.main-badge {
	display: inline-block;
	padding: 10px 40px;
	border-radius: 50px;
	font-size: 2rem;
	font-weight: 800;
	margin-bottom: 15px;
	box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
	transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.legend-row {
	display: flex;
	justify-content: center;
	gap: 8px;
	flex-wrap: wrap;
	margin-bottom: 15px;
}

.legend-chip {
	font-size: 0.8rem;
	padding: 6px 12px;
	border-radius: 12px;
	font-weight: 600;
	box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
}

.debug-toggle {
	background: none;
	border: none;
	color: #888;
	font-size: 0.8rem;
	cursor: pointer;
	text-decoration: underline;
}

.debug-box {
	margin-top: 10px;
	padding: 10px;
	background: #f1f2f6;
	border-radius: 8px;
	font-size: 0.85rem;
	color: #555;
	text-align: left;
}

.error-banner {
	background: #ff4757;
	color: white;
	padding: 10px;
	border-radius: 8px;
	margin-bottom: 10px;
}
</style>
