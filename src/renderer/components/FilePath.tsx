export function FilePath({ path }: { path: string }) {
  function handleClick() {
    window.wyvern.openInEditor(path);
  }

  return (
    <span
      className="text-xs text-cyan-400 cursor-pointer hover:underline underline-offset-2"
      title={path}
      onClick={handleClick}
    >{path}</span>
  );
}
