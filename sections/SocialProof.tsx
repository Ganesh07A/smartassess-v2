import { Container } from "../ui/Container";
import { Star } from "lucide-react";

export function SocialProof() {
  return (
    <section className="py-12 border-y border-gray-100 bg-gray-50/50">
      <Container className="flex flex-col md:flex-row items-center justify-center gap-8 text-center md:text-left">
        <div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Join over 10 million learners worldwide</h3>
          <div className="flex items-center gap-2 justify-center md:justify-start">
            <div className="flex text-green-500">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} size={16} fill="currentColor" />
              ))}
            </div>
            <span className="text-sm font-medium text-gray-600">4.8/5 on App Store</span>
          </div>
        </div>
      </Container>
    </section>
  );
}
