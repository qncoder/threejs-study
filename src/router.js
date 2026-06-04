import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';
import Zf18000ColumnDebugPage from './pages/Zf18000ColumnDebugPage.vue';
import Zf18000FourLinkDebugPage from './pages/Zf18000FourLinkDebugPage.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'editor',
      component: App,
      meta: {
        title: 'ZF18000 GLB 演示',
      },
    },
    {
      path: '/zf18000-column-height',
      name: 'zf18000-column-height',
      component: Zf18000ColumnDebugPage,
      meta: {
        title: 'ZF18000 立柱高度调试',
      },
    },
    {
      path: '/zf18000-fourlink',
      name: 'zf18000-fourlink',
      component: Zf18000FourLinkDebugPage,
      meta: {
        title: 'ZF18000 四连杆调试',
      },
    },
  ],
});

router.afterEach((to) => {
  if (typeof document === 'undefined') return;
  document.title = typeof to.meta?.title === 'string' ? to.meta.title : 'ZF18000 GLB 演示';
});

export default router;
