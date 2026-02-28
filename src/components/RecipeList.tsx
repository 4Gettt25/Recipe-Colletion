import { useState, useMemo } from 'react';
import { Plus, Search, SlidersHorizontal, ChefHat, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RecipeCard } from './RecipeCard';
import type { Recipe } from '@/types/recipe';

interface RecipeListProps {
  recipes: Recipe[];
  onAddRecipe: () => void;
  onSelectRecipe: (recipe: Recipe) => void;
  onToggleFavourite: (id: string) => void;
  onSaveToPhone?: (id: string) => void;
}

export function RecipeList({ recipes, onAddRecipe, onSelectRecipe, onToggleFavourite, onSaveToPhone }: RecipeListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'rating' | 'alphabetical'>('newest');
  const [filterTag, setFilterTag] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'all' | 'favourites'>('all');

  // Get all unique tags
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    recipes.forEach((recipe) => recipe.tags.forEach((tag) => tags.add(tag)));
    return Array.from(tags).sort();
  }, [recipes]);

  // Filter and sort recipes
  const filteredRecipes = useMemo(() => {
    let filtered = recipes;

    // Tab filter
    if (activeTab === 'favourites') {
      filtered = filtered.filter((recipe) => recipe.favourite);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (recipe) =>
          recipe.title.toLowerCase().includes(query) ||
          recipe.description.toLowerCase().includes(query) ||
          recipe.tags.some((tag) => tag.toLowerCase().includes(query)) ||
          recipe.ingredients.some((ing) => ing.name.toLowerCase().includes(query))
      );
    }

    // Tag filter
    if (filterTag && filterTag !== 'all') {
      filtered = filtered.filter((recipe) => recipe.tags.includes(filterTag));
    }

    // Sort
    const sorted = [...filtered];
    switch (sortBy) {
      case 'newest':
        sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'rating':
        sorted.sort((a, b) => b.rating - a.rating);
        break;
      case 'alphabetical':
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
    }

    return sorted;
  }, [recipes, searchQuery, sortBy, filterTag, activeTab]);

  // Count favourites
  const favouritesCount = useMemo(() => {
    return recipes.filter((r) => r.favourite).length;
  }, [recipes]);

  // Calculate stats
  const stats = useMemo(() => {
    const totalRecipes = recipes.length;
    const avgRating =
      totalRecipes > 0
        ? recipes.reduce((sum, r) => sum + r.rating, 0) / totalRecipes
        : 0;
    const totalIngredients = recipes.reduce((sum, r) => sum + r.ingredients.length, 0);
    return { totalRecipes, avgRating, totalIngredients };
  }, [recipes]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ChefHat className="w-7 h-7 text-orange-600" />
            My Recipes
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {stats.totalRecipes} recipes · {stats.avgRating.toFixed(1)} avg rating · {stats.totalIngredients} ingredients
          </p>
        </div>
        <Button onClick={onAddRecipe}>
          <Plus className="w-4 h-4 mr-1" />
          Add Recipe
        </Button>
      </div>

      {/* All / Favourites Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'all'
              ? 'bg-white text-orange-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          All ({recipes.length})
        </button>
        <button
          onClick={() => setActiveTab('favourites')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${
            activeTab === 'favourites'
              ? 'bg-white text-orange-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <Heart className="w-4 h-4" />
          Favourites ({favouritesCount})
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search recipes, ingredients, tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
            <SelectTrigger className="w-[140px]">
              <SlidersHorizontal className="w-4 h-4 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="rating">Highest Rated</SelectItem>
              <SelectItem value="alphabetical">A-Z</SelectItem>
            </SelectContent>
          </Select>
          {allTags.length > 0 && (
            <Select value={filterTag} onValueChange={setFilterTag}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Filter by tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tags</SelectItem>
                {allTags.map((tag) => (
                  <SelectItem key={tag} value={tag}>
                    {tag}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Recipe Grid */}
      {filteredRecipes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRecipes.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              onClick={() => onSelectRecipe(recipe)}
              onToggleFavourite={onToggleFavourite}
              onSaveToPhone={onSaveToPhone}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <ChefHat className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600">No recipes found</h3>
          <p className="text-gray-500 mt-1">
            {searchQuery || filterTag !== 'all'
              ? 'Try adjusting your search or filters'
              : activeTab === 'favourites'
              ? 'No favourites yet. Click the star on any recipe card to add it here!'
              : 'Start by adding your first recipe!'}
          </p>
          {!searchQuery && filterTag === 'all' && activeTab === 'all' && (
            <Button onClick={onAddRecipe} className="mt-4">
              <Plus className="w-4 h-4 mr-1" />
              Add Recipe
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
