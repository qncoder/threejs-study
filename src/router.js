import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';
import Zf18000BatchPage from './pages/Zf18000BatchPage.vue';
import Zf18000ColumnDebugPage from './pages/Zf18000ColumnDebugPage.vue';
import Zf18000FourLinkDebugPage from './pages/Zf18000FourLinkDebugPage.vue';
import Zf18000MetalHdrPage from './pages/Zf18000MetalHdrPage.vue';
import TransparentClipPage from './pages/TransparentClipPage.vue';
import ScraperConveyorPage from './pages/ScraperConveyorPage.vue';
import LightingLabPage from './pages/LightingLabPage.vue';

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
      path: '/zf18000-batch',
      name: 'zf18000-batch',
      component: Zf18000BatchPage,
      meta: {
        title: 'ZF18000 200 台批量加载',
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
    {
      path: '/zf18000-metal-hdr',
      name: 'zf18000-metal-hdr',
      component: Zf18000MetalHdrPage,
      meta: {
        title: 'ZF18000 HDR 金属质感',
      },
    },
    {
      path: '/transparent-clip',
      name: 'transparent-clip',
      component: TransparentClipPage,
      meta: {
        title: 'Transparent_Clip 透明剖切',
      },
    },
    {
      path: '/scraper-conveyor',
      name: 'scraper-conveyor',
      component: ScraperConveyorPage,
      meta: {
        title: '综采工作面刮板机仿真',
      },
    },
    {
      path: '/lighting-lab',
      name: 'lighting-lab',
      component: LightingLabPage,
      meta: {
        title: 'Three.js 灯光效果实验室',
      },
    },
  ],
});

router.afterEach((to) => {
  if (typeof document === 'undefined') return;
  document.title = typeof to.meta?.title === 'string' ? to.meta.title : 'ZF18000 GLB 演示';
});

export default router;
