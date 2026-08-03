import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // أجهزة الكاشير عند العملاء ويندوز 7 وقديمة: آخر كروم عليها 109 وآخر فايرفوكس ESR 115.
    // من غير تحديد الهدف ده، Vite بيبني بصيغة أحدث ممكن الجهاز القديم ما يقراهاش
    // فتطلع صفحة بيضا. الهدف الأقل بيوسّع التوافق مقابل زيادة بسيطة جدًا في الحجم.
    target: ['chrome87', 'edge88', 'firefox78', 'safari14'],
  },
})
