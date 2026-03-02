export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { RecipeDetailClient } from "@/components/recipe/RecipeDetailClient";
import { validateRecipeId } from "@/lib/validation";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function RecipePage({ params }: Props) {
  const { id } = await params;
  
  const validId = validateRecipeId(id);
  if (!validId) {
    notFound();
  }
  
  return <RecipeDetailClient id={validId} />;
}
