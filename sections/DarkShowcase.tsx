"use client";

import { motion } from "framer-motion";
import { Container } from "../ui/Container";

export function DarkShowcase() {
  return (
    <section className="bg-black py-32 text-white overflow-hidden relative">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-green-900/40 rounded-full blur-[150px] pointer-events-none" />

      <Container className="relative z-10 text-center">
        <motion.h2 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-4xl md:text-5xl font-bold mb-16"
        >
          Result Intelligence Engine
        </motion.h2>

        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="max-w-4xl mx-auto bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-8 md:p-12 shadow-2xl"
        >
          {/* Mock UI of the Marksheet Generation */}
          <div className="flex flex-col md:flex-row gap-8 items-center text-left">
            <div className="flex-1">
              <h3 className="text-2xl font-bold mb-4">Print-Ready Digital Marksheets</h3>
              <p className="text-gray-400 mb-6">
                SmartAssess doesn&apos;t just show a &quot;score out of 100&quot;. It dynamically generates editorial-grade, professional A4-printable digital marksheets that mirror official university standards.
              </p>
              <ul className="space-y-3 text-sm text-gray-300">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  Complex subject-wise marks
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  Intelligent color-coded grading
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  Direct PDF export functionality
                </li>
              </ul>
            </div>
            <div className="flex-1 w-full bg-black/50 border border-white/10 rounded-xl aspect-[1/1.2] flex flex-col items-center justify-center p-6">
              <div className="w-3/4 h-8 bg-white/10 rounded mb-4" />
              <div className="w-full h-px bg-white/10 mb-4" />
              <div className="w-full space-y-2">
                <div className="w-full h-6 bg-white/5 rounded" />
                <div className="w-full h-6 bg-white/5 rounded" />
                <div className="w-full h-6 bg-white/5 rounded" />
                <div className="w-full h-6 bg-green-500/20 rounded mt-4" />
              </div>
            </div>
          </div>
        </motion.div>
      </Container>
    </section>
  );
}
