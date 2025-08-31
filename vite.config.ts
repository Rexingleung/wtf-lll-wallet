import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import dts from "vite-plugin-dts";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), 
    dts({
      insertTypesEntry: true, // 会自动生成 index.d.ts 并在 package.json 添加 "types"
    }),
  ],
  build: {
    lib: {
      entry: "src/index.ts",
      name: "wtf-lll-wallet",
      formats: ["es"],
      fileName: (format) => `wtf-lll-wallet.${format}.js`
    },
    rollupOptions: {
      external: ["react", "react-dom"], // 避免打包 react
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM"
        }
      }
    }
  }
});