import { Container } from "../ui/Container";

export function TrustSection() {
  return (
    <section className="py-20 bg-gray-50/50 border-y border-gray-100">
      <Container className="text-center">
        <p className="text-sm font-semibold text-gray-500 tracking-widest uppercase mb-8">
          Trusted by Top Educators
        </p>
        <div className="flex flex-wrap justify-center gap-12 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
          {/* Placeholders for logos */}
          <div className="text-2xl font-black text-gray-900">Stanford</div>
          <div className="text-2xl font-black text-gray-900">MIT</div>
          <div className="text-2xl font-black text-gray-900">Harvard</div>
          <div className="text-2xl font-black text-gray-900">Oxford</div>
        </div>
      </Container>
    </section>
  );
}
