"use client";
import dynamic from "next/dynamic";

const TaskApp = dynamic(() => import("@/components/TaskApp"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 flex items-center justify-center bg-bg">
      <div className="w-16 h-16 rounded-2xl tm-auth-panel flex items-center justify-center shadow-pop tm-rise">
        <img src="/logo-icon-white.png" alt="" className="w-9 h-9" />
      </div>
    </div>
  ),
});

export default function Page() {
  return <TaskApp />;
}
