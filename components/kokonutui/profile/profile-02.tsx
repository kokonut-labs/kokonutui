"use client";

import {
    LogOut,
    Pencil,
    Flame,
    Shield,
    Check,
    X,
    Loader2,
    ArrowUpRight,
} from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { useState } from "react";

interface Profile02Props {
    name: string;
    role: string;
    avatar: string;
    subscription?: string;
    email?: string;
    level?: number;
    currentExp?: number;
    maxExp?: number;
}

const defaultProfile = {
    name: "Kokonut",
    role: "Making apps",
    avatar: "/av02.png",
    subscription: "Elite",
    email: "kokonut@example.com",
    level: 42,
    currentExp: 2800,
    maxExp: 4000,
} satisfies Required<Profile02Props>;

export default function Profile02({
    name = defaultProfile.name,
    role = defaultProfile.role,
    avatar = defaultProfile.avatar,
    subscription = defaultProfile.subscription,
    email = defaultProfile.email,
    level = defaultProfile.level,
    currentExp = defaultProfile.currentExp,
    maxExp = defaultProfile.maxExp,
}: Partial<Profile02Props> = defaultProfile) {
    const [isEditing, setIsEditing] = useState(false);
    const [newName, setNewName] = useState(name);
    const [isPending, setIsPending] = useState(false);

    const menuItems = [
        {
            icon: <ArrowUpRight className="w-4 h-4 text-amber-500" />,
            label: "Current Level",
            value: level,
            desc: `${currentExp} / ${maxExp} XP`,
            progress: (currentExp / maxExp) * 100,
        },
        {
            icon: <Flame className="w-4 h-4 text-red-500" />,
            label: "Daily Streak",
            value: "7 days",
            desc: "🔥 Keep it up!",
        },
        {
            icon: <Shield className="w-4 h-4 text-emerald-500" />,
            label: "Achievements",
            value: "12/30",
            desc: "Master III",
        },
    ];

    return (
        <div className="w-full max-w-md mx-auto">
            <div
                className="relative p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 
                bg-gradient-to-b from-white to-zinc-50/50 dark:from-zinc-900 dark:to-zinc-900/50"
            >
                <div className="flex items-start justify-between mb-6">
                    <div className="flex gap-4">
                        <div className="flex flex-col items-center">
                            <Image
                                src={avatar}
                                alt={name}
                                width={64}
                                height={64}
                                className="rounded-xl ring-2 ring-zinc-100 dark:ring-zinc-800"
                            />
                            <Badge
                                variant="secondary"
                                className="mt-2 px-2 py-0.5 text-xs font-medium 
                                    bg-gradient-to-r from-amber-100 to-amber-200 
                                    dark:from-amber-900/50 dark:to-amber-800/50 
                                    text-amber-700 dark:text-amber-400
                                    border-amber-200/50 dark:border-amber-800/50"
                            >
                                {subscription}
                            </Badge>
                        </div>
                        <div className="space-y-1">
                            {isEditing ? (
                                <div className="flex items-center gap-2">
                                    <Input
                                        value={newName}
                                        onChange={(e) =>
                                            setNewName(e.target.value)
                                        }
                                        className="h-7 text-sm bg-zinc-50 dark:bg-zinc-800/50 
                                            border-zinc-200/50 dark:border-zinc-800/50 
                                            focus:ring-offset-0 focus:ring-1 focus:ring-zinc-300 
                                            dark:focus:ring-zinc-700"
                                        disabled={isPending}
                                    />
                                    <div className="flex gap-1">
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-7 w-7"
                                        >
                                            {isPending ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Check className="h-4 w-4 text-green-500" />
                                            )}
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-7 w-7"
                                            onClick={() => setIsEditing(false)}
                                        >
                                            <X className="h-4 w-4 text-red-500" />
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <h2 className="text-lg font-semibold">
                                        {name}
                                    </h2>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7"
                                        onClick={() => setIsEditing(true)}
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            )}
                            <p className="text-sm text-zinc-500">{role}</p>
                            <p className="text-sm text-zinc-400">{email}</p>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                    >
                        <LogOut className="w-4 h-4" />
                    </Button>
                </div>

                {/* Menu Items */}
                <div className="space-y-4">
                    {menuItems.map((item) => (
                        <div
                            key={item.label}
                            className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 
                                border border-zinc-200/50 dark:border-zinc-800/50"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    {item.icon}
                                    <span className="text-sm font-medium">
                                        {item.label}
                                    </span>
                                </div>
                                <span className="text-lg font-semibold">
                                    {item.value}
                                </span>
                            </div>
                            {item.progress ? (
                                <div className="space-y-2">
                                    <Progress
                                        value={item.progress}
                                        className="h-2"
                                    />
                                    <p className="text-xs text-zinc-400">
                                        {item.desc}
                                    </p>
                                </div>
                            ) : (
                                <p className="text-xs text-zinc-400">
                                    {item.desc}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}