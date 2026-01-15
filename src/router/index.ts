import { createRouter, createWebHistory } from "vue-router";
import ClothColorDetector from "../components/ClothColorDetector.vue";
import BlueBoxQuiz from "../components/BlueBoxQuiz.vue";

const routes = [
	{ path: "/", component: ClothColorDetector },
	{ path: "/bluebox", component: BlueBoxQuiz },
];

const router = createRouter({
	history: createWebHistory(),
	routes,
});

export default router;
