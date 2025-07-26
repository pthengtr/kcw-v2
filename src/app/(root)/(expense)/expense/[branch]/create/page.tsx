"use client";
import { useParams } from "next/navigation";

export default function Create() {
  const { branch } = useParams();
  return <div>Create: {branch}</div>;
}
