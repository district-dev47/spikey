import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
    include: ['chart.js', 'react-chartjs-2']
  },
  build: {
    commonjsOptions: {
      include: [/chart\.js/, /react-chartjs-2/]
    },
    rollupOptions: {
      external: ['chart.js', 'react-chartjs-2'],
      output: {
        globals: {
          'chart.js': 'Chart',
          'react-chartjs-2': 'ReactChartjs2'
        }
      }
    }
  }
});
