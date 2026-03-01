import { Users, Star, ChevronRight, ImageIcon, Smartphone, Monitor, Download, WifiOff } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Recipe } from '@/types/recipe';
import { StarRating } from './StarRating';
import { isNative, isConnected } from '@/lib/api';

interface RecipeCardProps {
  recipe: Recipe;
  onClick: () => void;
  onToggleFavourite: (id: string) => void;
  onSaveToPhone?: (id: string) => void;
}

export function RecipeCard({ recipe, onClick, onToggleFavourite, onSaveToPhone }: RecipeCardProps) {
  return (
    <Card
      onClick={onClick}
      className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:-translate-y-1 group overflow-hidden"
    >
      {/* Recipe Image */}
      {recipe.imageUrl ? (
        <div className="w-full h-40 overflow-hidden relative">
          <img
            src={recipe.imageUrl}
            alt={recipe.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <FavouriteButton
            favourite={recipe.favourite}
            onToggle={(e) => { e.stopPropagation(); onToggleFavourite(recipe.id); }}
            overlay
          />
        </div>
      ) : (
        <div className="w-full h-40 bg-gradient-to-br from-orange-50 to-orange-100 flex items-center justify-center relative">
          <ImageIcon className="w-10 h-10 text-orange-300" />
          <FavouriteButton
            favourite={recipe.favourite}
            onToggle={(e) => { e.stopPropagation(); onToggleFavourite(recipe.id); }}
            overlay
          />
        </div>
      )}
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-lg leading-tight group-hover:text-orange-600 transition-colors">
            {recipe.title}
          </h3>
          <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-orange-500 transition-colors flex-shrink-0" />
        </div>
        {recipe.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {recipe.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
            {recipe.tags.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{recipe.tags.length - 3}
              </Badge>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm text-gray-600 line-clamp-2 mb-3">
          {recipe.description || 'No description'}
        </p>
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center gap-3 text-gray-500">
            <span className="flex items-center gap-1 whitespace-nowrap">
              <Users className="w-4 h-4 shrink-0" />
              {recipe.basePortions} portions
            </span>
            <span className="flex items-center gap-1 whitespace-nowrap">
              <Star className="w-4 h-4 shrink-0" />
              {recipe.ingredients.length} ingredients
            </span>
          </div>
          <StarRating rating={recipe.rating} size="sm" />
        </div>
        {recipe.source && (isConnected() || recipe.source === 'local' || recipe.source === 'saved') && (
          <div className="mt-2 flex items-center justify-between gap-2">
            {recipe.source === 'local' ? (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 border border-orange-200">
                <Smartphone className="w-3 h-3" />
                Phone only
              </span>
            ) : recipe.source === 'saved' ? (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-600 border border-green-200">
                <WifiOff className="w-3 h-3" />
                Saved offline
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
                <Monitor className="w-3 h-3" />
                Desktop
              </span>
            )}
            {recipe.source === 'server' && isNative() && onSaveToPhone && (
              <button
                onClick={e => { e.stopPropagation(); onSaveToPhone(recipe.id); }}
                title="Save to phone for offline use"
                className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100 transition-colors"
              >
                <Download className="w-3 h-3" />
                Save to phone
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FavouriteButton({
  favourite,
  onToggle,
  overlay,
}: {
  favourite: boolean;
  onToggle: (e: React.MouseEvent) => void;
  overlay?: boolean;
}) {
  return (
    <button
      onClick={onToggle}
      title={favourite ? 'Remove from favourites' : 'Add to favourites'}
      className={`
        absolute top-2 right-2 p-1.5 rounded-full transition-all duration-150
        ${overlay
          ? 'bg-white/80 hover:bg-white shadow-sm'
          : 'bg-gray-100 hover:bg-gray-200'}
        ${favourite ? 'text-yellow-400' : 'text-gray-400 hover:text-yellow-400'}
      `}
    >
      <Star
        className="w-4 h-4"
        fill={favourite ? 'currentColor' : 'none'}
        strokeWidth={2}
      />
    </button>
  );
}
