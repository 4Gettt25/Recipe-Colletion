export interface Ingredient {
  id: string;
  name: string;
  amount: number;
  unit: string;
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  ingredients: Ingredient[];
  instructions: string[];
  basePortions: number;
  rating: number; // 1-5 stars
  favourite: boolean;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  imageUrl?: string;
  source?: 'local' | 'server' | 'saved';
}

export type RecipeFormData = Omit<Recipe, 'id' | 'createdAt' | 'updatedAt' | 'source'>;
