"use client";

import { motion } from "framer-motion";
import { Container } from "../ui/Container";
import { FileUp, Clock, Lock, CheckCircle2 } from "lucide-react";

export function FeatureMini() {
  const features = [
    {
      icon: <FileUp className="text-blue-500" size={24} />,
      title: "Bulk CSV Upload",
      desc: "Spawn assessments instantly from spreadsheets."
    },
    {
      icon: <Lock className="text-green-500" size={24} />,
      title: "Server-side Locking",
      desc: "Exams automatically close securely on the backend."
    },
    {
      icon: <Clock className="text-purple-500" size={24} />,
      title: "Zero-Latency UI",
      desc: "Next.js SSR ensures blisteringly fast interactions."
    },
    {
      icon: <CheckCircle2 className="text-orange-500" size={24} />,
      title: "Automated Evaluation",
      desc: "Algorithmic grading saves hours of manual work."
    }
  ];

  return (
    <section className="py-24 bg-white">
      <Container>
        <div className="grid md:grid-cols-4 gap-8">
          {features.map((f, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="flex flex-col items-center text-center p-6"
            >
              <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-6 shadow-sm border border-gray-100">
                {f.icon}
              </div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">{f.title}</h4>
              <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </Container>
    </section>
  );
}
