"use client";

import { motion } from "framer-motion";
import { Container } from "../ui/Container";
import { Button } from "../ui/Button";
import Link from "next/link";

export function FinalCTA() {

  return (
    <section className="bg-black py-32 text-center text-white relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[300px] bg-gradient-to-b from-green-500/20 to-transparent blur-[100px] pointer-events-none" />

      <Container className="relative z-10">
        <motion.h2 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-5xl md:text-6xl font-bold mb-10 tracking-tight"
        >
          Everyone is a learner. <br/>
          <span className="text-green-400">Start solving today.</span>
        </motion.h2>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
        >
          <Link href="/login">
            <Button size="lg" className="px-12 text-lg">Get Started Now</Button>
          </Link>
        </motion.div>
      </Container>
    </section>
  );
}
