type BranchExpenseProps = {
  params: Promise<{ branch: string }>;
};

export default async function BranchExpense({ params }: BranchExpenseProps) {
  const { branch } = await params;

  return (
    <div>
      <h1>Parameter: {branch}</h1>
    </div>
  );
}
