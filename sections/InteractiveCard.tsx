"use client";

import { useState } from "react";
import { motion } from "framer-motion";

export default function InteractiveCard() {
  const [selected, setSelected] = useState<number | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const options = [
    { id: 1, text: "O(n)", correct: false },
    { id: 2, text: "O(log n)", correct: true },
    { id: 3, text: "O(n^2)", correct: false },
    { id: 4, text: "O(1)", correct: false },
  ];

  const handleSelect = (index: number) => {
    setSelected(index);
    if (options[index].correct) {
      setResult("Correct 🎉 Binary Search is O(log n).");
    } else {
      setResult("Incorrect. Try again!");
    }
  };

  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      className="bg-white/80 backdrop-blur-xl p-6 rounded-2xl shadow-xl w-[320px] border border-gray-100"
    >
      <h3 className="font-semibold text-gray-900 mb-4 text-sm">
        What is the time complexity of Binary Search?
      </h3>

      <div className="space-y-2">
        {options.map((opt, i) => (
          <button
            key={opt.id}
            onClick={() => handleSelect(i)}
            className={`w-full text-left px-4 py-3 rounded-xl border transition-all duration-200 ${
              selected === i
                ? opt.correct
                  ? "bg-green-50 border-green-500 text-green-700"
                  : "bg-red-50 border-red-500 text-red-700"
                : "bg-white border-gray-200 hover:border-blue-500 hover:bg-blue-50"
            }`}
          >
            <span className="text-sm font-medium">{opt.text}</span>
          </button>
        ))}
      </div>

      {result && (
        <motion.p
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mt-4 text-sm font-medium text-center ${
            result.includes("Correct") ? "text-green-600" : "text-red-500"
          }`}
        >
          {result}
        </motion.p>
      )}
    </motion.div>
  );
}
