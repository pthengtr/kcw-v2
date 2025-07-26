"use client";
import { useParams } from "next/navigation";

export default function Summary() {
  const { branch } = useParams();
  return <div>Summary: {branch}</div>;
}
