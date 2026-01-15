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
}

#app {
	min-height: 100vh;
	background: #ffffff;
	font-family: "Pretendard", sans-serif;
	color: #333;
}

.app-layout {
	display: flex;
	flex-direction: column;
	min-height: 100vh;
}

.page-container {
	flex: 1;
	display: flex;
	justify-content: center;
	align-items: center;
}
</style>
