"use client";

import { useState } from "react";
import { motion } from "framer-motion";

const correctOrder = ["Initialize", "Process", "Output"];

export default function PuzzleCard() {
  const [items, setItems] = useState([
    "Process",
    "Output",
    "Initialize",
  ]);

  const [result, setResult] = useState<string | null>(null);

  const moveItem = (index: number, direction: "up" | "down") => {
    const newItems = [...items];
    const target = direction === "up" ? index - 1 : index + 1;

    if (target < 0 || target >= items.length) return;

    [newItems[index], newItems[target]] = [
      newItems[target],
      newItems[index],
    ];

    setItems(newItems);
  };

  const checkAnswer = () => {
    const isCorrect =
      JSON.stringify(items) === JSON.stringify(correctOrder);

    setResult(isCorrect ? "Correct 🎉" : "Try again!");
  };

  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      className="bg-white/95 backdrop-blur-xl p-6 rounded-2xl shadow-xl w-[320px] text-gray-900 border border-gray-100"
    >
      <h3 className="font-semibold text-gray-900">
        Arrange steps of a program:
      </h3>

      <div className="mt-4 space-y-2">
        {items.map((item, i) => (
          <div
            key={i}
            className="flex justify-between items-center px-4 py-2 bg-gray-100 rounded-lg text-gray-800 border border-gray-200/50"
          >
            <span className="text-sm font-semibold">{item}</span>

            <div className="flex gap-2 text-gray-600 font-bold">
              <button onClick={() => moveItem(i, "up")} className="hover:text-blue-600 transition-colors p-1">⬆</button>
              <button onClick={() => moveItem(i, "down")} className="hover:text-blue-600 transition-colors p-1">⬇</button>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={checkAnswer}
        className="mt-4 w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 rounded-lg transition-colors"
      >
        Check
      </button>

      {result && (
        <p className="mt-3 text-sm font-semibold text-center text-gray-800">{result}</p>
      )}
    </motion.div>
  );
}