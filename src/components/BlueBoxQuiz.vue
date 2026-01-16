<script setup lang="ts">
import { ref, onMounted } from "vue";

const input1 = ref("");
const input2 = ref("");
const input3 = ref("");
const isSolved = ref(false);
const errorMsg = ref("");

// Template refs - used in template via ref attribute
// @ts-ignore - TS6133: Used in template, not detected by TypeScript
const inputRef1 = ref<HTMLInputElement | null>(null);
const inputRef2 = ref<HTMLInputElement | null>(null);
const inputRef3 = ref<HTMLInputElement | null>(null);

const handleInput = (currentInput: number, value: string) => {
	// Allow only single digit
	const digit = value.replace(/[^0-9]/g, "").slice(0, 1);

	if (currentInput === 1) {
		input1.value = digit;
		if (digit && inputRef2.value) {
			inputRef2.value.focus();
		}
	} else if (currentInput === 2) {
		input2.value = digit;
		if (digit && inputRef3.value) {
			inputRef3.value.focus();
		}
	} else if (currentInput === 3) {
		input3.value = digit;
	}
};

onMounted(() => {
	// Auto-focus first input on mount
	if (inputRef1.value) {
		inputRef1.value.focus();
	}
});

const checkAnswer = () => {
	// Check for 3, 5, 8
	if (input1.value === "3" && input2.value === "5" && input3.value === "8") {
		isSolved.value = true;
		errorMsg.value = "";
	} else {
		errorMsg.value = "비밀번호가 틀렸습니다.";
		setTimeout(() => {
			errorMsg.value = "";
		}, 2000);
	}
};

const reset = () => {
	isSolved.value = false;
	input1.value = "";
	input2.value = "";
	input3.value = "";
	errorMsg.value = "";
};
</script>

<template>
	<div class="blue-box-page">
		<div class="center-card">
			<h1 class="page-title">🟦 파란색 상자의 비밀</h1>

			<transition name="fade" mode="out-in">
				<!-- 1. QUIZ STATE -->
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
							<strong>3가지 숫자</strong>를 입력해봐"
						</p>
					</div>

					<div class="input-row">
						<input
							ref="inputRef1"
							:value="input1"
							@input="(e) => handleInput(1, (e.target as HTMLInputElement).value)"
							type="text"
							inputmode="numeric"
							class="code-input"
							placeholder="?"
						/>
						<input
							ref="inputRef2"
							:value="input2"
							@input="(e) => handleInput(2, (e.target as HTMLInputElement).value)"
							type="text"
							inputmode="numeric"
							class="code-input"
							placeholder="?"
						/>
						<input
							ref="inputRef3"
							:value="input3"
							@input="(e) => handleInput(3, (e.target as HTMLInputElement).value)"
							type="text"
							inputmode="numeric"
							class="code-input"
							placeholder="?"
						/>
					</div>

					<button @click="checkAnswer" class="action-btn">상자 열기</button>

					<p class="error-message" :class="{ visible: errorMsg }">
						{{ errorMsg || "..." }}
					</p>
				</div>

				<!-- 2. SUCCESS STATE -->
				<div v-else class="success-content" key="success">
					<div class="footprint-visual">🐾</div>
					<h2>상자가 열렸습니다!</h2>
					<div class="reward-box">
						<p class="reward-desc">숫자 힌트</p>
						<p class="reward-item">5</p>
						<!-- <p class="reward-desc">이 찍혀있었습니다.</p> -->
					</div>

					<div class="secret-msg">
						<strong>🎁 숨겨진 메시지:</strong><br />
						다음 단계로 이동하세요!
					</div>

					<button @click="reset" class="action-btn secondary">
						다시 잠그기
					</button>
				</div>
			</transition>
		</div>
	</div>
</template>

<style scoped>
.blue-box-page {
	width: 100%;
	height: 100%;
	display: flex;
	justify-content: center;
	align-items: center;
	padding: 3%;
	box-sizing: border-box;
	overflow: hidden;
	position: relative;
}

.center-card {
	background: white;
	width: 100%;
	max-width: 500px;
	height: 90%;
	/* max-height: 1300px; */
	border-radius: 25px;
	padding: 40px 40px;
	border: 1px solid #eee;
	box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
	text-align: center;
	position: relative;
	overflow-y: hidden;
	overflow-x: hidden;
	display: flex;
	flex-direction: column;
}

.page-title {
	font-size: 1.5rem;
	color: #2c3e50;
	margin-bottom: 25px;
	font-weight: 800;
	flex-shrink: 0;
}

/* Visuals */
.quiz-content {
	display: flex;
	flex-direction: column;
	justify-content: center;
	height: 100%;
	padding: 20px 0;
}

.box-visual {
	width: 110px;
	height: 110px;
	background: #3498db;
	margin: 0 auto 25px;
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
	margin-bottom: 25px;
}

.riddle-text {
	font-size: 1rem;
	line-height: 1.5;
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
	margin-bottom: 35px;
}
.code-input {
	width: 60px;
	height: 60px;
	font-size: 1.5rem;
	text-align: center;
	border: 2px solid #eee;
	border-radius: 12px;
	font-weight: bold;
	color: #2c3e50;
	transition: all 0.3s;
	background: #fcfcfc;
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
	font-size: 1.1rem;
	font-weight: bold;
	cursor: pointer;
	transition: background 0.2s;
}
.action-btn:hover {
	background: #2980b9;
}
.action-btn.secondary {
	background: #95a5a6;
}

/* Feedback */
.error-message {
	margin-top: 20px;
	color: #e74c3c;
	font-size: 0.9rem;
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
	padding: 20px 0;
}

.footprint-visual {
	font-size: 4rem;
	margin: 15px 0 20px 0;
	animation: bounce 2s infinite;
}

.success-content h2 {
	margin: 10px 0 20px 0;
	font-size: 1.4rem;
}

.reward-box {
	background: #f0f8ff;
	padding: 18px;
	border-radius: 15px;
	margin: 0 0 20px 0;
	border: 2px dashed #a2d2ff;
}

.reward-desc {
	margin: 5px 0;
	font-size: 0.95rem;
}

.reward-item {
	font-size: 1.3rem;
	font-weight: 800;
	color: #2980b9;
	margin: 8px 0;
}

.secret-msg {
	background: #f8f9fa;
	padding: 12px;
	border-radius: 12px;
	margin-bottom: 20px;
	line-height: 1.4;
	text-align: center;
	width: 100%;
	font-size: 0.9rem;
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
		border: none;
		box-shadow: none;
		padding: 30px 20px;
		height: 95%;
		max-height: none;
	}
	.blue-box-page {
		padding: 2%;
		align-items: center;
	}
	.page-title {
		font-size: 1.3rem;
		margin-bottom: 20px;
	}
	.box-visual {
		width: 90px;
		height: 90px;
		margin: 0 auto 15px;
	}
}
</style>
