export default function LoadingFallback() {
  return (
    <div className="flex h-screen w-full items-start justify-center bg-transparent mt-1">
      {/* Invisible placeholder to maintain DOM layout stability without showing a spinner */}
    </div>
  );
}
