<script setup lang="ts">
import { ref } from "vue";

const input1 = ref("");
const input2 = ref("");
const input3 = ref("");
const isSolved = ref(false);
const errorMsg = ref("");

const checkAnswer = () => {
	// Check for 3, 5, 8
	if (
		input1.value.trim() === "3" &&
		input2.value.trim() === "5" &&
		input3.value.trim() === "8"
	) {
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
							v-model="input1"
							type="number"
							class="code-input"
							placeholder="?"
							maxlength="1"
						/>
						<input
							v-model="input2"
							type="number"
							class="code-input"
							placeholder="?"
							maxlength="1"
						/>
						<input
							v-model="input3"
							type="number"
							class="code-input"
							placeholder="?"
							maxlength="1"
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
						<p class="reward-desc">상자 안에는 전설 속의</p>
						<p class="reward-item">"토끼 대왕의 발자국"</p>
						<p class="reward-desc">이 찍혀있었습니다.</p>
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
	min-height: 100vh;
	display: flex;
	justify-content: center;
	align-items: center;
	padding: 20px;
	box-sizing: border-box;
}

.center-card {
	background: white;
	width: 100%;
	max-width: 400px;
	border-radius: 25px;
	padding: 40px 30px;
	border: 1px solid #eee;
	box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
	text-align: center;
	position: relative;
	overflow: hidden;
}

.page-title {
	font-size: 1.5rem;
	color: #2c3e50;
	margin-bottom: 30px;
	font-weight: 800;
}

/* Visuals */
.box-visual {
	width: 120px;
	height: 120px;
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

.riddle-text {
	font-size: 1.05rem;
	line-height: 1.6;
	color: #555;
	margin-bottom: 25px;
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
	margin-bottom: 30px;
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
	margin-top: 15px;
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
.footprint-visual {
	font-size: 5rem;
	margin: 20px 0;
	animation: bounce 2s infinite;
}
.reward-box {
	background: #f0f8ff;
	padding: 20px;
	border-radius: 15px;
	margin: 20px 0 30px;
	border: 2px dashed #a2d2ff;
}
.reward-item {
	font-size: 1.4rem;
	font-weight: 800;
	color: #2980b9;
	margin: 10px 0;
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
		padding: 20px 0;
	}
	.blue-box-page {
		padding: 15px;
		align-items: flex-start; /* Move to top on mobile */
	}
}
</style>
