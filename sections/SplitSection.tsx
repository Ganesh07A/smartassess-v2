"use client";

import { motion } from "framer-motion";
import { Container } from "../ui/Container";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface SplitSectionProps {
  title: string;
  description: string;
  visual: ReactNode;
  reverse?: boolean;
  bg?: string;
}

export function SplitSection({ title, description, visual, reverse, bg = "bg-white" }: SplitSectionProps) {
  return (
    <section className={cn("py-24", bg)}>
      <Container className="grid md:grid-cols-2 gap-16 items-center">
        
        <motion.div 
          initial={{ opacity: 0, x: reverse ? 40 : -40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className={cn("max-w-md", reverse && "md:order-2")}
        >
          <h2 className="text-4xl font-bold text-gray-900 leading-tight">
            {title}
          </h2>
          <p className="mt-6 text-lg text-gray-600">
            {description}
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className={cn("relative", reverse && "md:order-1")}
        >
          {visual}
        </motion.div>

      </Container>
    </section>
  );
}
