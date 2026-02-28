import { useState } from 'react';
import { ArrowLeft, Edit2, Trash2, Minus, Plus, Users, ChefHat, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { Recipe } from '@/types/recipe';
import { StarRating } from './StarRating';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface RecipeDetailProps {
  recipe: Recipe;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRate: (rating: number) => void;
}

export function RecipeDetail({ recipe, onBack, onEdit, onDelete, onRate }: RecipeDetailProps) {
  const [portions, setPortions] = useState(recipe.basePortions);

  const scaleFactor = portions / recipe.basePortions;

  const scaleAmount = (amount: number) => {
    const scaled = amount * scaleFactor;
    // Round to reasonable decimal places
    if (scaled >= 10) return Math.round(scaled);
    if (scaled >= 1) return Math.round(scaled * 10) / 10;
    return Math.round(scaled * 100) / 100;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
      </div>

      {/* Title Section */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{recipe.title}</h1>
            <p className="text-gray-500 text-sm mt-1">
              Created on {formatDate(recipe.createdAt)}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Edit2 className="w-4 h-4 mr-1" />
              Edit
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Recipe</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete &quot;{recipe.title}&quot;? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete} className="bg-red-600 hover:bg-red-700">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {recipe.description && (
          <p className="text-gray-700">{recipe.description}</p>
        )}

        {/* Tags */}
        {recipe.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {recipe.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Rating */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">Your Rating:</span>
          <StarRating rating={recipe.rating} interactive onRate={onRate} />
        </div>

        {/* Recipe Image */}
        {recipe.imageUrl ? (
          <div className="w-full h-64 rounded-xl overflow-hidden">
            <img
              src={recipe.imageUrl}
              alt={recipe.title}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="w-full h-40 rounded-xl bg-gradient-to-br from-orange-50 to-orange-100 flex flex-col items-center justify-center">
            <ImageIcon className="w-12 h-12 text-orange-300 mb-2" />
            <span className="text-sm text-orange-400">No image uploaded</span>
          </div>
        )}
      </div>

      <Separator />

      {/* Portion Scaler */}
      <div className="bg-orange-50 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-orange-600" />
            <span className="font-medium">Portions</span>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPortions((p) => Math.max(1, p - 1))}
            >
              <Minus className="w-4 h-4" />
            </Button>
            <span className="font-semibold text-lg w-8 text-center">{portions}</span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPortions((p) => Math.min(50, p + 1))}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Base recipe makes {recipe.basePortions} portions. Adjust to scale ingredients.
        </p>
      </div>

      {/* Ingredients */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <ChefHat className="w-5 h-5" />
          Ingredients
        </h2>
        <ul className="space-y-2">
          {recipe.ingredients.map((ingredient) => (
            <li
              key={ingredient.id}
              className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-md"
            >
              <span className="font-medium">{ingredient.name}</span>
              <span className="text-gray-600">
                {scaleAmount(ingredient.amount)} {ingredient.unit}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Instructions */}
      {recipe.instructions.some((inst) => inst.trim()) && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Instructions</h2>
          <ol className="space-y-4">
            {recipe.instructions
              .filter((inst) => inst.trim())
              .map((instruction, index) => (
                <li key={index} className="flex gap-3">
                  <span className="flex-shrink-0 w-7 h-7 bg-orange-100 text-orange-700 rounded-full flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </span>
                  <p className="text-gray-700 pt-1">{instruction}</p>
                </li>
              ))}
          </ol>
        </div>
      )}
    </div>
  );
}
