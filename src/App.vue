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
html,
body {
	margin: 0;
	padding: 0;
	height: 100%;
	width: 100%;
	overflow: hidden;
	position: fixed;
}

#app {
	height: 100%;
	width: 100%;
	background: #ffffff;
	font-family: "Pretendard", sans-serif;
	color: #333;
	overflow: hidden;
	position: relative;
}

.app-layout {
	display: flex;
	flex-direction: column;
	height: 100%;
	width: 100%;
	position: relative;
}

.page-container {
	flex: 1;
	display: flex;
	justify-content: center;
	align-items: center;
	width: 100%;
	height: 100%;
	overflow: hidden;
}
</style>
