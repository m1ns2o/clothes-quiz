<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { PoseLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import {
	analyzeRegionColor,
	forceClassifyColor,
	type ColorResult,
} from "../utils/colorClassifier";

const CORRECT_ANSWER = "보라색";

// Basic refs
const videoRef = ref<HTMLVideoElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);

const status = ref("준비 중...");
const errorMsg = ref("");

// State
const isCameraReady = ref(false);
const isProcessing = ref(false);
const quizState = ref<"idle" | "success" | "failure">("idle");
const detectedResult = ref<ColorResult | null>(null);

let poseLandmarker: PoseLandmarker | null = null;
let stream: MediaStream | null = null;

async function initMediaPipe() {
	try {
		status.value = "AI 모델 로딩 중...";
		const vision = await FilesetResolver.forVisionTasks(
			"https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
		);

		poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
			baseOptions: {
				modelAssetPath:
					"https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
				delegate: "GPU",
			},
			runningMode: "IMAGE",
			numPoses: 1,
			minPoseDetectionConfidence: 0.3,
			minPosePresenceConfidence: 0.3,
		});
		status.value = "준비 완료";
	} catch (err: any) {
		errorMsg.value = "AI 모델 로딩 실패: " + err.message;
	}
}

// --- Camera Logic ---
async function startCamera() {
	if (stream) {
		stream.getTracks().forEach((t) => t.stop());
	}
	try {
		stream = await navigator.mediaDevices.getUserMedia({
			video: {
				width: { ideal: 1280 },
				height: { ideal: 720 },
				facingMode: "user",
			},
		});

		if (videoRef.value) {
			videoRef.value.srcObject = stream;
			// video.play() is handled by autoplay
			isCameraReady.value = true;
			reset();
		}
	} catch (err: any) {
		errorMsg.value = "카메라 접근 실패: " + err.message;
		isCameraReady.value = false;
	}
}

function stopCamera() {
	if (stream) {
		stream.getTracks().forEach((t) => t.stop());
		stream = null;
	}
	isCameraReady.value = false;
}

// --- Capture & Analyze ---
async function captureAndAnalyze() {
	if (!poseLandmarker || !videoRef.value || !canvasRef.value) return;

	isProcessing.value = true;
	quizState.value = "idle";

	const video = videoRef.value;
	const canvas = canvasRef.value;
	const ctx = canvas.getContext("2d");
	if (!ctx) return;

	// 1. Draw Video Frame to Canvas
	canvas.width = video.videoWidth;
	canvas.height = video.videoHeight;
	const w = canvas.width;
	const h = canvas.height;

	ctx.save();
	ctx.translate(w, 0);
	ctx.scale(-1, 1);
	ctx.drawImage(video, 0, 0, w, h);
	ctx.restore();

	// 2. Detect
	try {
		const result = await poseLandmarker.detect(canvas);

		// Default ROI (Center)
		let roi = { x: w * 0.375, y: h * 0.375, w: w * 0.25, h: h * 0.25 };

		if (
			result.landmarks &&
			result.landmarks.length > 0 &&
			result.landmarks[0]
		) {
			const lm = result.landmarks[0];
			const lSh = lm[11];
			const rSh = lm[12];
			const lHip = lm[23];
			const rHip = lm[24];

			if (lSh && rSh && lHip && rHip) {
				const cx = (lSh.x + rSh.x) / 2;
				const shoulderW = Math.abs(lSh.x - rSh.x);
				const shoulderY = (lSh.y + rSh.y) / 2;
				const hipY = (lHip.y + rHip.y) / 2;
				const torsoH = Math.abs(hipY - shoulderY);

				roi.w = shoulderW * 0.4 * w;
				roi.h = torsoH * 0.4 * h;
				roi.x = cx * w - roi.w / 2;
				roi.y = shoulderY * h + torsoH * 0.2 * h;
			}
		}

		// 3. Color Extraction (Average Method - like quiz.html)
		const imageData = ctx.getImageData(roi.x, roi.y, roi.w, roi.h);

		// Use simple average analysis which proved more robust than K-Means
		let best: ColorResult = analyzeRegionColor(imageData, 0, 0, roi.w, roi.h);

		// 4. Final Fallback if still unknown (low s/v but hue exists?)
		if (best.label === "알 수 없음") {
			console.log("Low confidence/Unknown. Force classifying by Hue...");
			const label = forceClassifyColor(best.hsv.h);
			best = {
				...best,
				label,
				confidence: 0.1,
			};
		}

		if (best) {
			detectedResult.value = best;
			// Check Answer
			if (best.label === CORRECT_ANSWER) {
				quizState.value = "success";
			} else {
				quizState.value = "failure";
			}
		} else {
			// Should strictly not happen with forceClassifyColor
			quizState.value = "failure";
		}
	} catch (err: any) {
		console.error(err);
		errorMsg.value = "분석 오류: " + err.message;
	} finally {
		isProcessing.value = false;
	}
}

function reset() {
	quizState.value = "idle";
	detectedResult.value = null;
	// Clear canvas to reveal video
	const canvas = canvasRef.value;
	const ctx = canvas?.getContext("2d");
	if (canvas && ctx) {
		ctx.clearRect(0, 0, canvas.width, canvas.height);
	}
}

// File Upload Support - Removed unused logic

onMounted(() => {
	initMediaPipe();
	startCamera(); // Auto start
});

onUnmounted(() => {
	stopCamera();
});
</script>

<template>
	<div class="detector-container">
		<h1 class="title">🔍 어울리는 옷을 찾아라!</h1>

		<!-- Camera/Canvas Wrapper -->
		<div class="camera-wrapper">
			<video
				ref="videoRef"
				playsinline
				autoplay
				muted
				class="video-layer"
			></video>
			<canvas ref="canvasRef" class="canvas-layer"></canvas>

			<!-- Guide Overlay -->
			<div class="guide-overlay" v-if="quizState === 'idle'">
				<svg viewBox="0 0 200 200" class="guide-svg">
					<path
						d="M 60 80 Q 100 80 140 80 L 140 180 L 60 180 Z"
						fill="none"
						stroke="white"
						stroke-width="2"
						stroke-dasharray="5,5"
					/>
					<circle
						cx="100"
						cy="50"
						r="15"
						fill="none"
						stroke="white"
						stroke-width="2"
						stroke-dasharray="5,5"
					/>
				</svg>
			</div>

			<!-- Processing Loader -->
			<div v-if="isProcessing" class="loader">분석 중...</div>

			<!-- Controls (Inside Wrapper) -->
			<div class="controls" v-if="quizState === 'idle'">
				<button
					@click="captureAndAnalyze"
					class="btn primary"
					:disabled="isProcessing"
				>
					📸 촬영 및 확인
				</button>
			</div>
		</div>

		<!-- Results Modal -->
		<div v-if="quizState !== 'idle'" class="result-modal">
			<div class="modal-content">
				<!-- Success -->
				<div v-if="quizState === 'success'" class="result-box success">
					<div class="icon">🎉</div>
					<h2>정답입니다!</h2>
					<p>
						인식된 색상:
						<span class="detected-color">{{
							detectedResult?.label || "알 수 없음"
						}}</span>
					</p>
					<div v-if="!isSolved" class="quiz-content" key="quiz">
						<div class="box-visual">
							<div class="lid"></div>
							<div class="box-body">
								<span class="lock">🔒</span>
							</div>
						</div>

						<div class="riddle-container">
							<p class="riddle-text">
								"의복에서의 이상적인 <strong>황금 비율</strong>과 관련된<br />
								<strong>3가지 숫자</strong>"
							</p>
						</div>

						<div class="input-row">
							<input
								type="text"
								inputmode="numeric"
								class="code-input"
								placeholder="?"
							/>
							<input
								type="text"
								inputmode="numeric"
								class="code-input"
								placeholder="?"
							/>
							<input
								type="text"
								inputmode="numeric"
								class="code-input"
								placeholder="?"
							/>
						</div>
					</div>
				</div>

				<!-- Failure -->
				<div v-if="quizState === 'failure'" class="result-box failure">
					<div class="icon">🤔</div>
					<h2>아쉽네요...</h2>
					<p>
						인식된 색상:
						<span class="detected-color">{{
							detectedResult?.label || "알 수 없음"
						}}</span>
					</p>
					<div class="debug-hsv" v-if="detectedResult">
						HSV: {{ Math.round(detectedResult.hsv.h) }},
						{{ Math.round(detectedResult.hsv.s) }},
						{{ Math.round(detectedResult.hsv.v) }}
					</div>
					<button @click="reset" class="btn secondary">다시 시도</button>
				</div>
			</div>
		</div>

		<div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>
	</div>
</template>

<style scoped>
/* Centered Portrait Layout */
.detector-container {
	width: 100%;
	height: 100%;
	margin: 0;
	/* padding: 3% 0; */
	font-family: "Pretendard", sans-serif;
	text-align: center;
	background: #ffffff; /* Page background */
	display: flex;
	flex-direction: column;
	/* justify-content: center; */
	align-items: center;
	position: relative;
	overflow: hidden;
	box-sizing: border-box;
}

.camera-wrapper {
	position: relative;
	/* 85% Height, wider Portrait Ratio optimized */
	height: 85%;
	max-height: 90%;
	aspect-ratio: 3/4;
	max-width: 90%;

	background: black;
	border-radius: 25px;
	overflow: hidden;
	box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2);
}

.title {
	font-size: 2rem;
	font-weight: bold;
	color: #2c3e50;
	/* margin: 0 0 20px 0; */
}

.video-layer,
.canvas-layer {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	object-fit: cover;
}
.video-layer {
	transform: scaleX(-1);
}
.canvas-layer {
	z-index: 10;
}

.guide-overlay {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	z-index: 20;
	pointer-events: none;
	display: flex;
	justify-content: center;
	align-items: center;
}
.guide-svg {
	width: 80%;
	height: auto;
	opacity: 0.8;
	max-width: 400px;
}

.loader {
	position: absolute;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
	background: rgba(0, 0, 0, 0.7);
	color: white;
	padding: 10px 20px;
	border-radius: 20px;
	z-index: 50;
	font-weight: bold;
}

.controls {
	position: absolute;
	bottom: 30px;
	left: 0;
	width: 100%;
	z-index: 30;
	display: flex;
	justify-content: center;
	padding: 0 20px;
	box-sizing: border-box;
}

.controls .btn {
	background: white;
	color: black;
	border: none;
	padding: 16px 30px;
	border-radius: 40px;
	font-size: 1.1rem;
	font-weight: bold;
	cursor: pointer;
	box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
	width: auto;
	min-width: 200px;
}
.controls .btn:active {
	transform: scale(0.98);
}
.controls .btn:disabled {
	opacity: 0.7;
	background: #ccc;
}

/* Modal */
.result-modal {
	position: fixed;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	background: rgba(0, 0, 0, 0.5); /* Dimmed background */
	z-index: 100;
	display: flex;
	justify-content: center;
	align-items: center;
	padding: 20px;
	backdrop-filter: blur(5px);
}

.modal-content {
	background: white;
	padding: 30px;
	border-radius: 25px;
	width: 100%;
	max-width: 320px;
	box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
	text-align: center;
}

.result-box {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 15px;
	color: #333;
}
.icon {
	font-size: 4rem;
}
h2 {
	font-size: 1.6rem;
	margin: 0;
}
p {
	color: #666;
	font-size: 1rem;
	margin: 0;
}

.detected-color {
	color: #e74c3c;
	font-weight: bold;
	font-size: 1.2rem;
}

.secret-msg {
	background: #f8f9fa;
	padding: 15px;
	border-radius: 12px;
	margin-bottom: 5px;
	line-height: 1.5;
	text-align: center;
	width: 100%;
	font-size: 0.95rem;
}

.btn {
	padding: 14px 0;
	border-radius: 15px;
	font-size: 1rem;
	font-weight: bold;
	cursor: pointer;
	border: none;
	width: 100%;
}
.btn.secondary {
	background: #f1f3f5;
	color: #495057;
}

.debug-hsv {
	font-size: 0.8rem;
	color: #adb5bd;
}

.error-msg {
	position: absolute;
	top: 70px;
	left: 0;
	width: 100%;
	color: #ff6b6b;
	text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
	z-index: 50;
	font-weight: bold;
}
.center-card {
	background: white;
	width: 80%;
	max-width: 450px;
	border-radius: 25px;
	padding: 30px;
	border: 1px solid #eee;
	box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
	text-align: center;
	position: relative;
	overflow: visible;
	display: flex;
	flex-direction: column;
	box-sizing: border-box;
}

.page-title {
	font-size: clamp(1.3rem, 4vw, 1.7rem);
	color: #2c3e50;
	margin-bottom: 20px;
	font-weight: 800;
	flex-shrink: 0;
}

/* Visuals */
.quiz-content {
	display: flex;
	flex-direction: column;
	justify-content: center;
	height: 100%;
	padding: 10px 0;
}

.box-visual {
	width: 90px;
	height: 90px;
	background: #3498db;
	margin: 0 auto 18px;
	border-radius: 15px;
	position: relative;
	box-shadow: 0 10px 20px rgba(52, 152, 219, 0.4);
	display: flex;
	align-items: center;
	justify-content: center;
}
.box-body {
	font-size: 3rem;
	color: white;
}
.lid {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 20px;
	background: #2980b9;
	border-radius: 15px 15px 0 0;
}

.riddle-container {
	margin-bottom: 18px;
}

.riddle-text {
	font-size: clamp(0.95rem, 3vw, 1.15rem);
	line-height: 1.6;
	color: #555;
	margin-bottom: 0;
	word-break: keep-all;
}
.riddle-text strong {
	color: #2980b9;
}

/* Inputs */
.input-row {
	display: flex;
	justify-content: center;
	gap: 12px;
	margin-bottom: 25px;
}
.code-input {
	width: clamp(50px, 12vw, 60px);
	height: clamp(50px, 12vw, 60px);
	font-size: clamp(1.3rem, 4vw, 1.7rem);
	text-align: center;
	border: 2px solid #eee;
	border-radius: 12px;
	font-weight: bold;
	color: #2c3e50;
	transition: all 0.3s;
	background: #fcfcfc;
	box-sizing: border-box;
	/* Remove Spin Buttons for Firefox */
	-moz-appearance: textfield;
}

/* Remove Spin Buttons for Chrome, Safari, Edge, Opera */
.code-input::-webkit-outer-spin-button,
.code-input::-webkit-inner-spin-button {
	-webkit-appearance: none;
	margin: 0;
}

.code-input::placeholder {
	text-align: center;
	color: #ccc;
	font-weight: normal;
}
.code-input:focus {
	border-color: #3498db;
	outline: none;
	background: white;
	transform: translateY(-2px);
	box-shadow: 0 4px 10px rgba(52, 152, 219, 0.1);
}

/* Buttons */
.action-btn {
	width: 100%;
	padding: 16px;
	background: #3498db;
	color: white;
	border: none;
	border-radius: 12px;
	font-size: clamp(1rem, 3.5vw, 1.25rem);
	font-weight: bold;
	cursor: pointer;
	transition: background 0.2s;
	box-sizing: border-box;
}
.action-btn:hover {
	background: #2980b9;
}
.action-btn.secondary {
	background: #95a5a6;
}

/* Feedback */
.error-message {
	margin-top: 15px;
	color: #e74c3c;
	font-size: 1rem;
	opacity: 0;
	transition: opacity 0.3s;
	min-height: 20px;
}
.error-message.visible {
	opacity: 1;
}

/* Success State */
.success-content {
	display: flex;
	flex-direction: column;
	justify-content: center;
	height: 100%;
	padding: 10px 0;
}

.footprint-visual {
	font-size: 3.5rem;
	margin: 10px 0 15px 0;
	animation: bounce 2s infinite;
}

.success-content h2 {
	margin: 8px 0 15px 0;
	font-size: clamp(1.3rem, 4vw, 1.6rem);
}

.reward-box {
	background: #f0f8ff;
	padding: 15px;
	border-radius: 15px;
	margin: 0 0 15px 0;
	border: 2px dashed #a2d2ff;
}

.reward-desc {
	margin: 5px 0;
	font-size: 1.05rem;
}

.reward-item {
	font-size: 1.5rem;
	font-weight: 800;
	color: #2980b9;
	margin: 8px 0;
}

.secret-msg {
	background: #f8f9fa;
	padding: 12px;
	border-radius: 12px;
	margin-bottom: 15px;
	line-height: 1.4;
	text-align: center;
	width: 100%;
	font-size: 1.05rem;
}

@keyframes bounce {
	0%,
	100% {
		transform: translateY(0);
	}
	50% {
		transform: translateY(-10px);
	}
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
	transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
	opacity: 0;
}

/* Mobile Tweaks */
@media (max-width: 480px) {
	.center-card {
		width: 85%;
		border: none;
		box-shadow: none;
		padding: 25px 18px;
	}
	.blue-box-page {
		padding: 2%;
		align-items: center;
	}
	.page-title {
		font-size: 1.4rem;
		margin-bottom: 15px;
	}
	.box-visual {
		width: 80px;
		height: 80px;
		margin: 0 auto 12px;
	}
	.input-row {
		gap: 8px;
		margin-bottom: 20px;
	}
	.code-input {
		width: 48px;
		height: 48px;
		font-size: 1.2rem;
	}
}
</style>
