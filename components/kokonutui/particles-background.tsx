"use client";

import { useEffect, useRef, useCallback } from "react";
import { motion } from "motion/react";

interface CyberBackgroundProps {
    gridSize?: number;
    particleCount?: number;
    noiseIntensity?: number;
}

function createNoise() {
    const permutation = [
        151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225,
        140, 36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148, 247,
        120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57,
        177, 33, 88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74,
        165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122,
        60, 211, 133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54,
        65, 25, 63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169,
        200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3,
        64, 52, 217, 226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85,
        212, 207, 206, 59, 227, 47, 16, 58, 17, 182, 189, 28, 42, 223, 183, 170,
        213, 119, 248, 152, 2, 44, 154, 163, 70, 221, 153, 101, 155, 167, 43,
        172, 9, 129, 22, 39, 253, 19, 98, 108, 110, 79, 113, 224, 232, 178, 185,
        112, 104, 218, 246, 97, 228, 251, 34, 242, 193, 238, 210, 144, 12, 191,
        179, 162, 241, 81, 51, 145, 235, 249, 14, 239, 107, 49, 192, 214, 31,
        181, 199, 106, 157, 184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150,
        254, 138, 236, 205, 93, 222, 114, 67, 29, 24, 72, 243, 141, 128, 195,
        78, 66, 215, 61, 156, 180,
    ];

    const p = new Array(512);
    for (let i = 0; i < 256; i++) p[256 + i] = p[i] = permutation[i];

    function fade(t: number) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    function lerp(t: number, a: number, b: number) {
        return a + t * (b - a);
    }

    function grad(hash: number, x: number, y: number, z: number) {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }

    return {
        simplex3: (x: number, y: number, z: number) => {
            const X = Math.floor(x) & 255;
            const Y = Math.floor(y) & 255;
            const Z = Math.floor(z) & 255;

            x -= Math.floor(x);
            y -= Math.floor(y);
            z -= Math.floor(z);

            const u = fade(x);
            const v = fade(y);
            const w = fade(z);

            const A = p[X] + Y;
            const AA = p[A] + Z;
            const AB = p[A + 1] + Z;
            const B = p[X + 1] + Y;
            const BA = p[B] + Z;
            const BB = p[B + 1] + Z;

            return lerp(
                w,
                lerp(
                    v,
                    lerp(u, grad(p[AA], x, y, z), grad(p[BA], x - 1, y, z)),
                    lerp(
                        u,
                        grad(p[AB], x, y - 1, z),
                        grad(p[BB], x - 1, y - 1, z)
                    )
                ),
                lerp(
                    v,
                    lerp(
                        u,
                        grad(p[AA + 1], x, y, z - 1),
                        grad(p[BA + 1], x - 1, y, z - 1)
                    ),
                    lerp(
                        u,
                        grad(p[AB + 1], x, y - 1, z - 1),
                        grad(p[BB + 1], x - 1, y - 1, z - 1)
                    )
                )
            );
        },
    };
}

export default function ParticlesBackground({
    particleCount = 100,
    noiseIntensity = 0.03,
}: CyberBackgroundProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const noise = createNoise();

    const drawParticles = useCallback(
        (ctx: CanvasRenderingContext2D, particles: Particle[]) => {
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

            for (const particle of particles) {
                const n = noise.simplex3(
                    particle.x * noiseIntensity,
                    particle.y * noiseIntensity,
                    Date.now() * 0.0001
                );

                const gradient = ctx.createRadialGradient(
                    particle.x,
                    particle.y,
                    0,
                    particle.x,
                    particle.y,
                    particle.size * 2
                );
                gradient.addColorStop(
                    0,
                    `hsla(${particle.hue}, 100%, 70%, 0.8)`
                );
                gradient.addColorStop(1, `hsla(${particle.hue}, 100%, 50%, 0)`);

                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
                ctx.fill();

                particle.x += Math.cos(n * Math.PI * 2) * 0.8;
                particle.y += Math.sin(n * Math.PI * 2) * 0.8;

                if (particle.x < -50) particle.x = ctx.canvas.width + 50;
                if (particle.x > ctx.canvas.width + 50) particle.x = -50;
                if (particle.y < -50) particle.y = ctx.canvas.height + 50;
                if (particle.y > ctx.canvas.height + 50) particle.y = -50;
            }
        },
        [noise, noiseIntensity]
    );

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const particles: Particle[] = Array.from(
            { length: particleCount },
            () => ({
                x: Math.random() * canvas.offsetWidth,
                y: Math.random() * canvas.offsetHeight,
                size: Math.random() * 3 + 2,
                hue: Math.random() * 60 + 200,
            })
        );

        const resize = () => {
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
        };

        const animate = () => {
            ctx.fillStyle = "rgba(9, 9, 11, 0.1)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            drawParticles(ctx, particles);
            requestAnimationFrame(animate);
        };

        resize();
        animate();
        window.addEventListener("resize", resize);
        return () => window.removeEventListener("resize", resize);
    }, [drawParticles, particleCount]);

    return (
        <div className="absolute inset-0 overflow-hidden bg-zinc-900">
            <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full"
            />

            <div className="absolute inset-0 flex items-center justify-center z-10">
                <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1.5, delay: 0.2 }}
                    className="text-7xl font-bold text-transparent bg-clip-text bg-linear-to-r from-indigo-400 via-pink-300 to-blue-400 relative z-20"
                >
                    <span className="relative inline-block">
                        Particles
                        <span className="absolute inset-0 text-transparent bg-clip-text bg-linear-to-r from-indigo-600/80 via-pink-500/80 to-blue-600/80 mix-blend-overlay -m-[2px]">
                            Particles
                        </span>
                    </span>
                </motion.h1>
            </div>

            <div className="absolute inset-0 bg-linear-to-b from-zinc-900/20 to-zinc-900/80 mix-blend-multiply z-15" />
        </div>
    );
}

interface Particle {
    x: number;
    y: number;
    size: number;
    hue: number;
}
