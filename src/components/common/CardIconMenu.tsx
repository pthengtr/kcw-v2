type CardIconMenuProps = {
  children: React.ReactNode;
};

export default function CardIconMenu({ children }: CardIconMenuProps) {
  return <div className="p-12 flex gap-12 justify-center">{children}</div>;
}
