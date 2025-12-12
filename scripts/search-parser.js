// search-parser.js - Advanced search syntax parser for Lora Manager

/**
 * Parse and evaluate advanced search queries with the following syntax:
 * - space: AND operator
 * - |: OR operator
 * - !: NOT operator
 * - < >: Grouping
 * - " ": Exact phrase matching
 *
 * Example queries:
 * - "tree green" (exact phrase)
 * - tree green (tree AND green)
 * - tree | green (tree OR green)
 * - tree !green (tree AND NOT green)
 * - <tree green> | blue (tree AND green) OR blue
 */

// Tokenize the search query into tokens
function tokenizeQuery(query) {
    // Handle empty query
    if (!query || query.trim() === '') {
        return [];
    }

    const tokens = [];
    let currentToken = '';
    let inQuotes = false;
    let inGroup = false;
    let groupDepth = 0;
    
    for (let i = 0; i < query.length; i++) {
        const char = query[i];
        
        // Handle quotes for exact phrase matching
        if (char === '"') {
            if (inQuotes) {
                // End of quoted phrase
                if (currentToken.trim()) {
                    tokens.push({
                        type: 'EXACT',
                        value: currentToken.trim()
                    });
                }
                currentToken = '';
                inQuotes = false;
            } else {
                // Start of quoted phrase
                if (currentToken.trim()) {
                    tokens.push({
                        type: 'TERM',
                        value: currentToken.trim()
                    });
                }
                currentToken = '';
                inQuotes = true;
            }
            continue;
        }
        
        // If we're inside quotes, just add the character to the current token
        if (inQuotes) {
            currentToken += char;
            continue;
        }
        
        // Handle grouping with < >
        if (char === '<') {
            if (currentToken.trim()) {
                tokens.push({
                    type: 'TERM',
                    value: currentToken.trim()
                });
                currentToken = '';
            }
            inGroup = true;
            groupDepth++;
            tokens.push({ type: 'GROUP_START' });
            continue;
        }
        
        if (char === '>') {
            if (currentToken.trim()) {
                tokens.push({
                    type: 'TERM',
                    value: currentToken.trim()
                });
                currentToken = '';
            }
            groupDepth--;
            if (groupDepth === 0) {
                inGroup = false;
            }
            tokens.push({ type: 'GROUP_END' });
            continue;
        }
        
        // Handle operators
        if (!inGroup && char === '|') {
            if (currentToken.trim()) {
                tokens.push({
                    type: 'TERM',
                    value: currentToken.trim()
                });
                currentToken = '';
            }
            tokens.push({ type: 'OR' });
            continue;
        }
        
        if (!inGroup && char === '!') {
            if (currentToken.trim()) {
                tokens.push({
                    type: 'TERM',
                    value: currentToken.trim()
                });
                currentToken = '';
            }
            tokens.push({ type: 'NOT' });
            continue;
        }
        
        // Handle spaces (AND operator)
        if (!inGroup && char === ' ') {
            if (currentToken.trim()) {
                tokens.push({
                    type: 'TERM',
                    value: currentToken.trim()
                });
                currentToken = '';
            }
            // Only add AND if there's already a token and the next character isn't an operator
            const nextChar = i + 1 < query.length ? query[i + 1] : null;
            if (tokens.length > 0 && nextChar && nextChar !== '|' && nextChar !== '!' && nextChar !== '<' && nextChar !== '>') {
                tokens.push({ type: 'AND' });
            }
            continue;
        }
        
        // Add character to current token
        currentToken += char;
    }
    
    // Add any remaining token
    if (currentToken.trim()) {
        tokens.push({
            type: 'TERM',
            value: currentToken.trim()
        });
    }
    
    return tokens;
}

// Parse tokens into a search expression tree
function parseTokens(tokens) {
    if (!tokens || tokens.length === 0) {
        return null;
    }
    
    // Simple recursive descent parser
    let position = 0;
    
    function parseExpression() {
        let left = parseTerm();
        
        while (position < tokens.length) {
            const token = tokens[position];
            
            if (token.type === 'AND') {
                position++;
                const right = parseTerm();
                left = { type: 'AND', left, right };
            } else if (token.type === 'OR') {
                position++;
                const right = parseTerm();
                left = { type: 'OR', left, right };
            } else if (token.type === 'NOT') {
                // Handle NOT operator in the expression context
                position++;
                const right = parseTerm();
                // Create an AND node with the left term and the negated right term
                left = { type: 'AND', left, right: { type: 'NOT', expr: right } };
            } else {
                break;
            }
        }
        
        return left;
    }
    
    function parseTerm() {
        if (position >= tokens.length) {
            return null;
        }
        
        const token = tokens[position];
        
        if (token.type === 'NOT') {
            position++;
            const expr = parseTerm();
            return { type: 'NOT', expr };
        }
        
        if (token.type === 'GROUP_START') {
            position++;
            const expr = parseExpression();
            
            // Expect GROUP_END
            if (position < tokens.length && tokens[position].type === 'GROUP_END') {
                position++;
                return expr;
            } else {
                // Missing closing bracket, but continue anyway
                return expr;
            }
        }
        
        if (token.type === 'TERM' || token.type === 'EXACT') {
            position++;
            return { type: token.type, value: token.value };
        }
        
        // Skip unexpected tokens
        position++;
        return parseTerm();
    }
    
    return parseExpression();
}

// Evaluate a search expression against a model
function evaluateExpression(expr, model) {
    if (!expr) {
        return true;
    }
    
    switch (expr.type) {
        case 'AND':
            return evaluateExpression(expr.left, model) && evaluateExpression(expr.right, model);
        
        case 'OR':
            return evaluateExpression(expr.left, model) || evaluateExpression(expr.right, model);
        
        case 'NOT':
            // For NOT operator, we need to ensure the term is actually excluded
            return !evaluateExpression(expr.expr, model);
        
        case 'TERM':
            return searchInModel(model, expr.value, false);
        
        case 'EXACT':
            return searchInModel(model, expr.value, true);
        
        default:
            return false;
    }
}

// Search for a term in a model's searchable fields
function searchInModel(model, term, exactMatch) {
    const searchTerm = term.toLowerCase();
    
    // Define all searchable fields in the model
    const searchableFields = [
        // Basic fields
        { value: model.name, weight: 10 },
        { value: model.filename, weight: 10 },
        { value: model.category, weight: 8 },
        { value: model.baseModel, weight: 7, exactMatch: true },
        
        // JSON fields
        { value: model.json?.['civitai name'], weight: 8 },
        { value: model.json?.['subcategory'], weight: 7 },
        { value: model.json?.['folder'], weight: 6 },
        { value: model.json?.['creator'], weight: 8, exactMatch: true },
        { value: model.json?.['tags'], weight: 9 },
        { value: model.json?.['activation text'], weight: 5 },
        { value: model.json?.['negative text'], weight: 5 },
        { value: model.json?.['civitai text'], weight: 5 },
        { value: model.json?.['description'], weight: 6 },
        { value: model.json?.['example prompt'], weight: 5 },
        
        // Path
        { value: model.path, weight: 4 }
    ];
    
    // For exact matching, we need the exact phrase in at least one field
    if (exactMatch) {
        return searchableFields.some(field => {
            if (!field.value) return false;
            const fieldValue = String(field.value).toLowerCase();
            
            // For fields that need exact matching (like baseModel)
            if (field.exactMatch) {
                // First try exact match
                if (fieldValue === searchTerm) {
                    return true;
                }
                // Then try as part of comma-separated list
                if (fieldValue.includes(',')) {
                    if (fieldValue.split(',').some(part => part.trim() === searchTerm)) {
                        return true;
                    }
                }
                // Finally, allow partial matches for these fields too
                return fieldValue.includes(searchTerm);
            }
            
            return fieldValue.includes(searchTerm);
        });
    }
    
    // If the term contains spaces, we treat it as a space-separated list of terms that should all match (AND operation)
    if (searchTerm.includes(' ')) {
        // Split the search term into individual words
        const searchWords = searchTerm.split(' ')
            .filter(word => word.trim() !== '');
            
        // Check if all individual words exist in any of the model's fields
        // This is the proper implementation of AND - all terms must match
        return searchWords.every(word => {
            // For each word, check if it exists in any field
            return searchableFields.some(field => {
                if (!field.value) return false;
                const fieldValue = String(field.value).toLowerCase();
                
                // For fields that need exact matching (like baseModel)
                if (field.exactMatch) {
                    // First try exact match
                    if (fieldValue === word.trim()) {
                        return true;
                    }
                    // Then try as part of comma-separated list
                    if (fieldValue.includes(',')) {
                        if (fieldValue.split(',').some(part => part.trim() === word.trim())) {
                            return true;
                        }
                    }
                    // Finally, allow partial matches for these fields too
                    return fieldValue.includes(word.trim());
                }
                
                return fieldValue.includes(word.trim());
            });
        });
    }
    
    // For single-word terms, check if it exists in any field
    return searchableFields.some(field => {
        if (!field.value) return false;
        
        // For fields that need exact matching (like baseModel and creator)
        if (field.exactMatch) {
            // Check for exact match or as part of a comma-separated list
            const fieldValue = String(field.value).toLowerCase();
            // First try exact match
            if (fieldValue === searchTerm) {
                return true;
            }
            // Then try as part of comma-separated list
            if (fieldValue.includes(',')) {
                return fieldValue.split(',').some(part => part.trim() === searchTerm);
            }
            // Finally, allow partial matches for these fields too
            return fieldValue.includes(searchTerm);
        }
        
        // For regular fields, use includes
        return String(field.value).toLowerCase().includes(searchTerm);
    });
}


// Main function to filter models based on search query
export function filterModelsByQuery(models, query) {
    if (!query || query.trim() === '') {
        return models; // Return all models if no query
    }
    
    // Tokenize and parse the query
    const tokens = tokenizeQuery(query);
    const expr = parseTokens(tokens);
    
    // Filter models based on the expression
    return models.filter(model => evaluateExpression(expr, model));
}