import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

export default function ScreenBlock({ children }: Props) {
  const isSmall = window.innerWidth < 1024;

  if (isSmall) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white text-center p-6">
        <div>
          <h1 className="text-2xl font-bold">Screen Too Small</h1>
          <p className="mt-3 opacity-80">
            This application is only available on large screens (PC or Laptop).
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
