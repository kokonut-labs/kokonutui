"use client";

import { wrap } from "@motionone/utils";
import {
    motion,
    useAnimationFrame,
    useMotionValue,
    useScroll,
    useSpring,
    useTransform,
    useVelocity,
} from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { cx } from "@/lib/utils";

interface Text07Props {
    text?: string;
    className?: string;
    defaultVelocity?: number;
}

export default function Text_07({
    text = "Velocity Scroll",
    className = "",
    defaultVelocity = 5
}: Text07Props) {
    interface ParallaxTextProps {
        children: string;
        baseVelocity: number;
        className?: string;
    }
    
    function ParallaxText({
        children,
        baseVelocity = 100,
        className,
    }: ParallaxTextProps) {
        const baseX = useMotionValue(0);
        const { scrollY } = useScroll();
        const scrollVelocity = useVelocity(scrollY);
        const smoothVelocity = useSpring(scrollVelocity, {
            damping: 50,
            stiffness: 400,
        });

        const velocityFactor = useTransform(smoothVelocity, [0, 1000], [0, 5], {
            clamp: false,
        });

        const [repetitions, setRepetitions] = useState(1);
        const containerRef = useRef<HTMLDivElement>(null);
        const textRef = useRef<HTMLSpanElement>(null);

        useEffect(() => {
            const calculateRepetitions = () => {
                if (!containerRef.current || !textRef.current) return;
                
                const containerWidth = containerRef.current.offsetWidth;
                const textWidth = textRef.current.offsetWidth;
                const newRepetitions = Math.ceil(containerWidth / textWidth) + 2;
                setRepetitions(newRepetitions);
            };

            calculateRepetitions();

            window.addEventListener("resize", calculateRepetitions);
            return () => window.removeEventListener("resize", calculateRepetitions);
        }, [children]);

        const x = useTransform(baseX, (v) => `${wrap(-100 / repetitions, 0, v)}%`);

        const directionFactor = useRef<number>(1);
        useAnimationFrame((_, delta) => {
            let moveBy = directionFactor.current * baseVelocity * (delta / 1000);

            if (velocityFactor.get() < 0) directionFactor.current = -1;
            else if (velocityFactor.get() > 0) directionFactor.current = 1;

            moveBy += directionFactor.current * moveBy * velocityFactor.get();
            baseX.set(baseX.get() + moveBy);
        });

        return (
            <div
                className="w-full overflow-hidden whitespace-nowrap"
                ref={containerRef}
            >
                <motion.div className={cx("inline-block", className)} style={{ x }}>
                    {Array.from({ length: repetitions }).map((_, i) => (
                        <span key={i} ref={i === 0 ? textRef : null}>
                            {children}{" "}
                        </span>
                    ))}
                </motion.div>
            </div>
        );
    }

    return (
        <section className="relative w-full">
            <ParallaxText baseVelocity={defaultVelocity} className={cx("font-display text-center text-4xl font-bold tracking-[-0.02em] text-black drop-shadow-sm md:text-7xl md:leading-[5rem] dark:text-white", className)}>
                {text}
            </ParallaxText>
            <ParallaxText baseVelocity={-defaultVelocity} className={cx("font-display text-center text-4xl font-bold tracking-[-0.02em] text-black drop-shadow-sm md:text-7xl md:leading-[5rem] dark:text-white", className)}>
                {text}
            </ParallaxText>
        </section>
    );
}
