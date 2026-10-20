export type SocialLink = {
  id: "instagram" | "facebook" | "linkedin" | "x";
  label: string;
  href: string;
  icon: "instagram" | "facebook" | "linkedin" | "x";
};

/** URLs reales pendientes de Juan — placeholders `#`. */
export const socialLinks: SocialLink[] = [
  {
    id: "instagram",
    label: "Instagram",
    href: "#",
    icon: "instagram",
  },
  {
    id: "facebook",
    label: "Facebook",
    href: "#",
    icon: "facebook",
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    href: "#",
    icon: "linkedin",
  },
  {
    id: "x",
    label: "X",
    href: "#",
    icon: "x",
  },
];
