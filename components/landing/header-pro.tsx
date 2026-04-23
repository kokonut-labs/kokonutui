import { ArrowUpRight, PartyPopper } from "lucide-react";
import Link from "next/link";
import { ConfettiOutline } from "../icons/conffeti";

export function HeaderPro() {
  return (
    <div className="sticky top-0 z-[100] w-full bg-[#FF2D55]">
      <div className="w-full px-4 py-2.5">
        <Link
          className="group flex items-center justify-center gap-2.5 tracking-tighter transition-opacity duration-200 md:gap-3"
          href="https://kokonutui.pro?utm_source=kokonutui.com&utm_medium=header"
          target="_blank"
        >
          {/* Desktop View */}
          <span className="hidden items-center gap-3 md:flex">
            <ConfettiOutline className="h-5 w-5 text-white" />
            <span className="text-md text-white tracking-tighter">
              Introducing <span className="font-bold">Kokonut UI Pro</span> -
              70+ new components and templates to build beautiful websites
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ArrowUpRight className="h-3.5 w-3.5 text-white transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </span>
          </span>

          {/* Mobile View */}
          <span className="flex items-center gap-2.5 md:hidden">
            <PartyPopper className="h-5 w-5 flex-shrink-0 text-white" />
            <span className="font-medium text-white text-xs leading-tight tracking-tight">
              Introducing Kokonut UI Pro - 70+ new components and templates to
              build beautiful websites
            </span>
            <ArrowUpRight className="h-3.5 w-3.5 flex-shrink-0 text-white transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </span>
        </Link>
      </div>
    </div>
  );
}
