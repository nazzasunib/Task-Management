"use client";
import dynamic from "next/dynamic";

const TaskApp = dynamic(() => import("@/components/TaskApp"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 flex items-center justify-center bg-bg">
      <img src="/logo-icon.png" alt="" className="w-16 h-16 rounded-2xl shadow-pop tm-rise" />
    </div>
  ),
});

export default function Page() {
  return <TaskApp />;
}
