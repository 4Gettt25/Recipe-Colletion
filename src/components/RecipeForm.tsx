import { useState, useRef } from 'react';
import { Plus, Trash2, X, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import type { Ingredient, RecipeFormData } from '@/types/recipe';
import { useTranslation } from 'react-i18next';

interface RecipeFormProps {
  initialData?: Partial<RecipeFormData>;
  onSubmit: (data: RecipeFormData) => void;
  onCancel: () => void;
}

const emptyFormData: RecipeFormData = {
  title: '',
  description: '',
  ingredients: [],
  instructions: [''],
  basePortions: 2,
  rating: 0,
  favourite: false,
  tags: [],
};

export function RecipeForm({ initialData, onSubmit, onCancel }: RecipeFormProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<RecipeFormData>({
    ...emptyFormData,
    ...initialData,
  });
  const [newTag, setNewTag] = useState('');
  const [newIngredient, setNewIngredient] = useState({ name: '', amount: '', unit: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert(t('recipeForm.maxSize'));
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({ ...prev, imageUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setFormData((prev) => ({ ...prev, imageUrl: undefined }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAddIngredient = () => {
    if (newIngredient.name.trim()) {
      const ingredient: Ingredient = {
        id: Math.random().toString(36).substring(2, 9),
        name: newIngredient.name.trim(),
        amount: newIngredient.amount ? parseFloat(newIngredient.amount) : 0,
        unit: newIngredient.unit,
      };
      setFormData((prev) => ({
        ...prev,
        ingredients: [...prev.ingredients, ingredient],
      }));
      setNewIngredient({ name: '', amount: '', unit: '' });
    }
  };

  const handleRemoveIngredient = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      ingredients: prev.ingredients.filter((i) => i.id !== id),
    }));
  };

  const handleAddInstruction = () => {
    setFormData((prev) => ({
      ...prev,
      instructions: [...prev.instructions, ''],
    }));
  };

  const handleUpdateInstruction = (index: number, value: string) => {
    setFormData((prev) => ({
      ...prev,
      instructions: prev.instructions.map((inst, i) => (i === index ? value : inst)),
    }));
  };

  const handleRemoveInstruction = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      instructions: prev.instructions.filter((_, i) => i !== index),
    }));
  };

  const handleAddTag = () => {
    if (newTag && !formData.tags.includes(newTag)) {
      setFormData((prev) => ({
        ...prev,
        tags: [...prev.tags, newTag],
      }));
      setNewTag('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tag),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.title && formData.ingredients.length > 0) {
      onSubmit(formData);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="title">{t('recipeForm.titleLabel')}</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
          placeholder={t('recipeForm.titlePlaceholder')}
          required
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">{t('recipeForm.descriptionLabel')}</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
          placeholder={t('recipeForm.descriptionPlaceholder')}
          rows={3}
        />
      </div>

      {/* Image Upload */}
      <div className="space-y-2">
        <Label>{t('recipeForm.imageLabel')}</Label>
        <div className="flex items-start gap-4">
          {formData.imageUrl ? (
            <div className="relative">
              <img
                src={formData.imageUrl}
                alt="Recipe preview"
                className="w-32 h-32 object-cover rounded-lg border"
              />
              <button
                type="button"
                onClick={handleRemoveImage}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-orange-400 hover:bg-orange-50 transition-colors"
            >
              <ImageIcon className="w-8 h-8 text-gray-400 mb-1" />
              <span className="text-xs text-gray-500">{t('recipeForm.addPhoto')}</span>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          <div className="text-sm text-gray-500 pt-2">
            <p>{t('recipeForm.uploadHint')}</p>
            <p>{t('recipeForm.maxSize')}</p>
          </div>
        </div>
      </div>

      {/* Base Portions */}
      <div className="space-y-2">
        <Label htmlFor="portions">{t('recipeForm.portionsLabel')}</Label>
        <div className="flex items-center gap-2">
          <Input
            id="portions"
            type="number"
            min={1}
            max={50}
            value={formData.basePortions}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, basePortions: parseInt(e.target.value) || 1 }))
            }
            className="w-24"
          />
          <span className="text-sm text-gray-500">
            {t('recipeForm.portionsHint')}
          </span>
        </div>
      </div>

      {/* Ingredients */}
      <div className="space-y-3">
        <Label>{t('recipeForm.ingredientsLabel')}</Label>
        <div className="flex gap-2 items-end">
          <div className="flex-1 space-y-1">
            <span className="text-xs text-gray-500">{t('recipeForm.ingredientName')}</span>
            <Input
              placeholder={t('recipeForm.ingredientName')}
              value={newIngredient.name}
              onChange={(e) => setNewIngredient((prev) => ({ ...prev, name: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddIngredient())}
            />
          </div>
          <div className="w-24 space-y-1">
            <span className="text-xs text-gray-500">{t('recipeForm.amount')} <span className="text-gray-400">(opt.)</span></span>
            <Input
              placeholder="e.g. 100"
              type="number"
              step="0.01"
              value={newIngredient.amount}
              onChange={(e) => setNewIngredient((prev) => ({ ...prev, amount: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddIngredient())}
            />
          </div>
          <div className="w-24 space-y-1">
            <span className="text-xs text-gray-500">{t('recipeForm.unit')} <span className="text-gray-400">(opt.)</span></span>
            <Input
              placeholder="e.g. g"
              value={newIngredient.unit}
              onChange={(e) => setNewIngredient((prev) => ({ ...prev, unit: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddIngredient())}
            />
          </div>
          <Button type="button" onClick={handleAddIngredient} variant="secondary">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        <div className="space-y-2">
          {formData.ingredients.map((ing) => (
            <div
              key={ing.id}
              className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-md"
            >
              <span className="text-sm">
                {ing.amount > 0 ? `${ing.name}: ${ing.amount}${ing.unit ? ' ' + ing.unit : ''}` : ing.name}
              </span>
              <button
                type="button"
                onClick={() => handleRemoveIngredient(ing.id)}
                className="text-red-500 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div className="space-y-3">
        <Label>{t('recipeForm.instructionsLabel')}</Label>
        {formData.instructions.map((instruction, index) => (
          <div key={index} className="flex gap-2">
            <span className="text-sm text-gray-500 w-6 flex-shrink-0 pt-2">{index + 1}.</span>
            <Textarea
              value={instruction}
              onChange={(e) => handleUpdateInstruction(index, e.target.value)}
              placeholder={t('recipeForm.stepPlaceholder', { number: index + 1 })}
              rows={2}
            />
            {formData.instructions.length > 1 && (
              <button
                type="button"
                onClick={() => handleRemoveInstruction(index)}
                className="text-red-500 hover:text-red-700 flex-shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
        <Button type="button" onClick={handleAddInstruction} variant="outline" size="sm">
          <Plus className="w-4 h-4 mr-1" />
          {t('recipeForm.addStep')}
        </Button>
      </div>

      {/* Tags */}
      <div className="space-y-3">
        <Label>{t('recipeForm.tagsLabel')}</Label>
        <div className="flex gap-2">
          <Input
            placeholder={t('recipeForm.tagPlaceholder')}
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
          />
          <Button type="button" onClick={handleAddTag} variant="secondary">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {formData.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="flex items-center gap-1">
              {tag}
              <button type="button" onClick={() => handleRemoveTag(tag)}>
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <Button type="submit" className="flex-1">
          {t('recipeForm.saveRecipe')}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('recipeForm.cancel')}
        </Button>
      </div>
    </form>
  );
}
