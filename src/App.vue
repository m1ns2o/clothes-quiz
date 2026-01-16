<script setup lang="ts">
// No script needed as router handles views
</script>

<template>
	<div class="app-layout">
		<main class="page-container">
			<router-view />
		</main>
	</div>
</template>

<style>
/* Global Reset */
body {
	margin: 0;
	height: 100vh;
	overflow: hidden;
}

#app {
	height: 100vh;
	width: 100%;
	background: #ffffff;
	font-family: "Pretendard", sans-serif;
	color: #333;
	overflow: hidden;
}

.app-layout {
	display: flex;
	flex-direction: column;
	height: 100vh;
	width: 100%;
}

.page-container {
	flex: 1;
	display: flex;
	justify-content: center;
	align-items: center;
	width: 100%;
	height: 100%;
}
</style>
