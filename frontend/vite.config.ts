import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import tanstackRouter from "@tanstack/router-plugin/vite";
import path from "path"

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tanstackRouter({
      target: "react",
      routesDirectory: "./src/apps",
      generatedRouteTree: "./src/routeTree.gen.ts",
      autoCodeSplitting: true
    }),
    react(),
    tailwindcss()],
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, './src') },
      { find: /^@networking\/api(.*)/, replacement: path.resolve(__dirname, '../packages/api$1') },
      { find: /^@networking\/service(.*)/, replacement: path.resolve(__dirname, '../packages/service/src$1') },
    ]
  },
  server: {
    port: 3001
  }
})
