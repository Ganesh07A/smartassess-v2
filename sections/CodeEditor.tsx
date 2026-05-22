"use client";

import Editor from "@monaco-editor/react";
import { useState } from "react";

export default function CodeEditor() {
  const [code, setCode] = useState(`function add(a, b) {
  return a + b;
}

console.log(add(3, 5));`);

  const [output, setOutput] = useState("");

  const runCode = () => {
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args) => {
      logs.push(args.map(a => JSON.stringify(a)).join(" "));
    };

    try {
      // Use Function constructor instead of eval to avoid compiler warning
      const result = new Function(code)();
      if (logs.length > 0) {
        setOutput(logs.join("\n"));
      } else {
        setOutput(String(result));
      }
    } catch (err) {
      setOutput("Error: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      console.log = originalLog;
    }
  };

  return (
    <div className="bg-black rounded-2xl p-4 w-full max-w-xl">
      
      <Editor
        height="200px"
        defaultLanguage="javascript"
        theme="vs-dark"
        value={code}
        onChange={(value) => setCode(value || "")}
      />

      <button
        onClick={runCode}
        className="mt-3 bg-green-500 text-white px-4 py-2 rounded"
      >
        Run Code
      </button>

      <div className="mt-4 p-3 bg-zinc-900 rounded-lg border border-zinc-800 min-h-[50px] font-mono text-sm">
        <div className="text-zinc-500 mb-1 font-sans text-xs uppercase tracking-wider">Console Output</div>
        <pre className="text-green-400 whitespace-pre-wrap">
          {output || "No output yet. Click 'Run Code' to see results."}
        </pre>
      </div>
    </div>
  );
}