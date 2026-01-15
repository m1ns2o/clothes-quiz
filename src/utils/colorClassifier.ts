export type ColorLabel =
	| "하늘색"
	| "노란색"
	| "주황색"
	| "빨간색"
	| "보라색"
	| "알 수 없음";

export interface ColorResult {
	label: ColorLabel;
	confidence: number;
	rgb: { r: number; g: number; b: number };
	hsv: { h: number; s: number; v: number };
}

// Target centroids for each color (H, S, V)
// Aggressively map Blue/Indigo range to 'Purple'
const TARGET_COLORS: { label: ColorLabel; h: number }[] = [
	{ label: "빨간색", h: 0 },
	{ label: "주황색", h: 25 },
	{ label: "노란색", h: 50 },
	{ label: "하늘색", h: 175 }, // Strictly Cyan/Sky
	{ label: "보라색", h: 210 }, // Light Blue -> Maps to Purple
	{ label: "보라색", h: 250 }, // Blue -> Maps to Purple
	{ label: "보라색", h: 290 }, // Purple -> Maps to Purple
];

// RGB to HSV conversion
export function rgbToHsv(
	r: number,
	g: number,
	b: number
): { h: number; s: number; v: number } {
	r /= 255;
	g /= 255;
	b /= 255;

	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const diff = max - min;

	let h = 0;
	const s = max === 0 ? 0 : diff / max;
	const v = max;

	if (diff !== 0) {
		switch (max) {
			case r:
				h = 60 * (((g - b) / diff) % 6);
				break;
			case g:
				h = 60 * ((b - r) / diff + 2);
				break;
			case b:
				h = 60 * ((r - g) / diff + 4);
				break;
		}
	}

	if (h < 0) h += 360;

	return { h, s: s * 100, v: v * 100 };
}

// Distance based classification
export function classifyColor(
	h: number,
	s: number,
	v: number
): { label: ColorLabel; confidence: number } {
	// Relaxed saturation threshold
	if (s < 8 || v < 15) {
		return { label: "알 수 없음", confidence: 0.5 };
	}

	let minDistance = Infinity;
	let closestLabel: ColorLabel = "알 수 없음";

	for (const target of TARGET_COLORS) {
		let dist = Math.abs(h - target.h);
		if (dist > 180) dist = 360 - dist;

		if (target.label === "빨간색") {
			// Check 360 wrap
			let dist2 = Math.abs(h - 360);
			dist = Math.min(dist, dist2);
		}

		if (dist < minDistance) {
			minDistance = dist;
			closestLabel = target.label;
		}
	}

	// Calculate confidence (simple distance based)
	const confidence = Math.max(0, 1 - minDistance / 60);

	// Previously we filtered low confidence, but to match 'quiz.html' logic which was better:
	// always return the closest match if reasonable S/V passed.
	return { label: closestLabel, confidence };
}

// Force classification without thresholds (Fallback)
export function forceClassifyColor(h: number): ColorLabel {
	let minDistance = Infinity;
	let closestLabel: ColorLabel = "알 수 없음";

	for (const target of TARGET_COLORS) {
		let dist = Math.abs(h - target.h);
		if (dist > 180) dist = 360 - dist;

		if (target.label === "빨간색") {
			let dist2 = Math.abs(h - 360);
			dist = Math.min(dist, dist2);
		}

		if (dist < minDistance) {
			minDistance = dist;
			closestLabel = target.label;
		}
	}
	return closestLabel;
}

// Helper to analyze a region
export function analyzeRegionColor(
	imageData: ImageData,
	x: number,
	y: number,
	width: number,
	height: number
): ColorResult {
	const data = imageData.data;
	const imgWidth = imageData.width;
	let totalR = 0,
		totalG = 0,
		totalB = 0,
		count = 0;

	for (let py = y; py < y + height && py < imageData.height; py += 2) {
		for (let px = x; px < x + width && px < imgWidth; px += 2) {
			const idx = (py * imgWidth + px) * 4;
			totalR += data[idx] ?? 0;
			totalG += data[idx + 1] ?? 0;
			totalB += data[idx + 2] ?? 0;
			count++;
		}
	}

	if (count === 0)
		return {
			label: "알 수 없음",
			confidence: 0,
			rgb: { r: 0, g: 0, b: 0 },
			hsv: { h: 0, s: 0, v: 0 },
		};

	const r = Math.round(totalR / count);
	const g = Math.round(totalG / count);
	const b = Math.round(totalB / count);
	const hsv = rgbToHsv(r, g, b);

	// Debug log
	console.log(
		`Region HSV: H=${Math.round(hsv.h)}, S=${Math.round(hsv.s)}, V=${Math.round(
			hsv.v
		)}`
	);

	const { label, confidence } = classifyColor(hsv.h, hsv.s, hsv.v);

	return { label, confidence, rgb: { r, g, b }, hsv };
}

// Enhanced K-Means extraction extraction
export function extractDominantColors(
	imageData: ImageData,
	x: number,
	y: number,
	width: number,
	height: number,
	k: number = 3
): ColorResult[] {
	const data = imageData.data;
	const imgWidth = imageData.width;
	const pixels: [number, number, number][] = [];

	const step = 3;
	for (let py = y; py < y + height && py < imageData.height; py += step) {
		for (let px = x; px < x + width && px < imgWidth; px += step) {
			const idx = (py * imgWidth + px) * 4;
			pixels.push([data[idx] ?? 0, data[idx + 1] ?? 0, data[idx + 2] ?? 0]);
		}
	}

	if (pixels.length < k)
		return [analyzeRegionColor(imageData, x, y, width, height)];

	const centroids = kMeansClustering(pixels, k, 10);

	return centroids
		.map((c) => {
			const hsv = rgbToHsv(c[0], c[1], c[2]);
			const { label, confidence } = classifyColor(hsv.h, hsv.s, hsv.v);

			// Debug log
			console.log(`Dominant HSV: H=${Math.round(hsv.h)} => ${label}`);

			return {
				label,
				confidence,
				rgb: { r: Math.round(c[0]), g: Math.round(c[1]), b: Math.round(c[2]) },
				hsv,
			};
		})
		.filter((c) => c.label !== "알 수 없음");
}

function kMeansClustering(
	pixels: [number, number, number][],
	k: number,
	iterations: number
): [number, number, number][] {
	if (pixels.length === 0) return [];
	const centroids: [number, number, number][] = [];

	// Initialize centroids safely
	for (let i = 0; i < k; i++) {
		const randIdx = Math.floor(Math.random() * pixels.length);
		const pixel = pixels[randIdx];
		if (pixel) centroids.push(pixel);
	}

	while (centroids.length < k && centroids.length > 0) {
		const existing = centroids[0];
		if (existing) centroids.push(existing);
		else break;
	}

	for (let iter = 0; iter < iterations; iter++) {
		const clusters: [number, number, number][][] = Array.from(
			{ length: k },
			() => []
		);

		for (const p of pixels) {
			let minDist = Infinity,
				best = 0;
			for (let i = 0; i < k; i++) {
				const centroid = centroids[i];
				if (!centroid) continue;

				const d = Math.sqrt(
					(p[0] - centroid[0]) ** 2 +
						(p[1] - centroid[1]) ** 2 +
						(p[2] - centroid[2]) ** 2
				);
				if (d < minDist) {
					minDist = d;
					best = i;
				}
			}
			if (clusters[best]) {
				clusters[best]!.push(p);
			}
		}

		for (let i = 0; i < k; i++) {
			const cluster = clusters[i];
			if (cluster && cluster.length > 0) {
				let r = 0,
					g = 0,
					b = 0;
				for (const p of cluster) {
					r += p[0];
					g += p[1];
					b += p[2];
				}
				centroids[i] = [
					r / cluster.length,
					g / cluster.length,
					b / cluster.length,
				];
			}
		}
	}
	return centroids;
}
