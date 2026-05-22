"use client";

import { motion } from "framer-motion";
import { Container } from "../ui/Container";
import { Button } from "../ui/Button";
import Link from "next/link";
import PuzzleCard from "./PuzzleCard";
import InteractiveCard from "./InteractiveCard";

export function Hero() {

  return (
    <section className="relative pt-32 pb-24 overflow-hidden">
      {/* Subtle Floating Orbs */}
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-green-200 rounded-full blur-[120px] opacity-30 pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-[300px] h-[300px] bg-blue-200 rounded-full blur-[100px] opacity-30 pointer-events-none" />

      <Container className="relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Content */}
          <div className="text-left">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight text-black"
            >
              Learn. <br />
              <span className="bg-gradient-to-r from-green-500 to-blue-500 text-transparent bg-clip-text">by doing.</span>
            </motion.h1>

            <motion.p 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
              className="mt-6 text-xl text-gray-600 max-w-xl"
            >
              Experience next-gen assessments with AI-powered evaluation, real-time coding, and instant results. Stop reading, start doing.
            </motion.p>

            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
              className="mt-10 flex items-center gap-4"
            >
              <Link href="/login">
                <Button size="lg" className="w-[200px]">Get Started</Button>
              </Link>
            </motion.div>
          </div>

          {/* Right: Interactive Cards */}
          <div className="relative h-[650px] hidden lg:flex items-center justify-center perspective-[1000px] overflow-visible">
            <motion.div
              initial={{ opacity: 0, x: 20, rotateY: -10 }}
              animate={{ opacity: 1, x: 0, rotateY: 0 }}
              transition={{ duration: 1, delay: 0.2 }}
              className="absolute top-20 right-0 z-20"
            >
              <InteractiveCard />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20, rotateX: 10 }}
              animate={{ opacity: 1, x: 0, rotateX: 0 }}
              transition={{ duration: 1, delay: 0.4 }}
              className="absolute bottom-20 left-10 z-10"
            >
              <PuzzleCard />
            </motion.div>
          </div>
        </div>
      </Container>
    </section>
  );
}
