'use client';

interface VoiceMenuItemCardProps {
  data: {
    name: string;
    price: number;
    description?: string;
    imageUrl?: string;
    category?: string;
    type?: string;
    rating?: number;
    spiceLevel?: number;
    dietary?: string[];
    available?: boolean;
  };
  onAction?: (action: string, data: any) => void;
}

export function VoiceMenuItemCard({ data, onAction }: VoiceMenuItemCardProps) {
  const handleAddToCart = () => {
    onAction?.('add_to_cart_verbal', {
      dishName: data.name,
      quantity: 1
    });
  };

  return (
    <div className="neu-card overflow-hidden hover-lift animate-fade-in">
      {/* Image */}
      {data.imageUrl && (
        <div className="relative h-48 bg-gradient-to-br from-gray-100 to-gray-200">
          <img
            src={data.imageUrl}
            alt={data.name}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="p-6 space-y-4">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h3 className="text-2xl font-bold neu-text mb-1">{data.name}</h3>
            {data.category && (
              <span className="text-xs neu-text-secondary uppercase tracking-wide">
                {data.category}
              </span>
            )}
          </div>
          <div className="text-2xl font-bold neu-text-accent">₹{data.price}</div>
        </div>

        {/* Rating & Type */}
        <div className="flex items-center gap-3">
          {data.rating && (
            <div className="flex items-center gap-1">
              <span className="text-warning">⭐</span>
              <span className="font-semibold neu-text">{data.rating.toFixed(1)}</span>
            </div>
          )}
          {data.type && (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              data.type === 'veg'
                ? 'bg-veg-light text-veg-dark border border-veg'
                : 'bg-non-veg-light text-non-veg-dark border border-non-veg'
            }`}>
              {data.type === 'veg' ? '🌱 Veg' : '🍖 Non-Veg'}
            </span>
          )}
          {data.spiceLevel && data.spiceLevel > 0 && (
            <span className="flex items-center gap-1">
              {'🌶️'.repeat(Math.min(data.spiceLevel, 5))}
            </span>
          )}
        </div>

        {/* Description */}
        {data.description && (
          <p className="text-sm neu-text-secondary leading-relaxed">
            {data.description}
          </p>
        )}

        {/* Dietary Tags */}
        {data.dietary && data.dietary.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {data.dietary.map((tag, idx) => (
              <span
                key={idx}
                className="px-2 py-1 rounded-full text-xs neu-concave neu-text-secondary"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Add to Order Button */}
        <button
          onClick={handleAddToCart}
          disabled={data.available === false}
          className={`w-full neu-button-accent rounded-xl px-6 py-3 text-base font-semibold transition-all ${
            data.available === false ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {data.available === false ? 'Not Available' : `Add to Order • ₹${data.price}`}
        </button>
      </div>
    </div>
  );
}
