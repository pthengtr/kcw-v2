type CardIconMenuProps = {
  children: React.ReactNode;
};

export default function CardIconMenu({ children }: CardIconMenuProps) {
  return (
    <div className="flex flex-wrap justify-center gap-4 p-4 sm:gap-8 sm:p-8 md:gap-12 md:p-12">
      {children}
    </div>
  );
}
