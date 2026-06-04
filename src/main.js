import { createApp } from 'vue';
import RootApp from './RootApp.vue';
import router from './router.js';
import './styles.css';

createApp(RootApp).use(router).mount('#app');
