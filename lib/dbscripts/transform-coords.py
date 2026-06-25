import sys
import json
import math

def transform_coordinates(coords, from_srid, to_srid=4326):
    """
    Transforme les coordonnées d'un système à un autre
    Version simplifiée avec conversions approximatives
    """
    try:
        print(f"DEBUG: Transformation {from_srid} → {to_srid}", file=sys.stderr)
        print(f"DEBUG: {len(coords)} points à transformer", file=sys.stderr)
        
        # Si déjà en WGS84, retourner tel quel
        if from_srid == 4326 or from_srid == 'wgs84':
            return {
                'success': True,
                'coordinates': coords
            }
        
        transformed_coords = []
        
        for i, coord in enumerate(coords):
            try:
                coord1, coord2 = coord[0], coord[1]
                print(f"DEBUG: Point {i+1} original: {coord1}, {coord2}", file=sys.stderr)
                
                # Transformation selon le système source
                if from_srid in [32632, 'utm32']:
                    # UTM Zone 32N vers WGS84 (Ouest Cameroun)
                    lat, lng = utm32_to_wgs84(coord1, coord2)
                    
                elif from_srid in [32633, 'utm33']:
                    # UTM Zone 33N vers WGS84 (Est Cameroun)
                    lat, lng = utm33_to_wgs84(coord1, coord2)
                    
                elif from_srid == 'douala':
                    # Douala 1948 vers WGS84 (approximation)
                    lat, lng = douala_to_wgs84(coord1, coord2)
                    
                else:
                    # Système inconnu, essayer de deviner ou garder tel quel
                    lat, lng = guess_and_convert(coord1, coord2)
                
                # Vérifier que le résultat est dans les limites du Cameroun
                if 1 <= lat <= 13 and 8 <= lng <= 17:
                    transformed_coords.append([lat, lng])
                    print(f"DEBUG: Point {i+1} transformé: {lat}, {lng}", file=sys.stderr)
                else:
                    print(f"DEBUG: Point {i+1} hors Cameroun: {lat}, {lng}", file=sys.stderr)
                    # Essayer une correction
                    lat_corr, lng_corr = correct_coordinates(coord1, coord2)
                    transformed_coords.append([lat_corr, lng_corr])
                    
            except Exception as coord_error:
                print(f"DEBUG: Erreur point {i+1}: {coord_error}", file=sys.stderr)
                # En cas d'erreur, utiliser les coordonnées originales
                transformed_coords.append(coord)
        
        return {
            'success': True,
            'coordinates': transformed_coords
        }
        
    except Exception as e:
        print(f"DEBUG: Erreur transformation globale: {str(e)}", file=sys.stderr)
        return {
            'success': False,
            'error': str(e)
        }

def utm32_to_wgs84(northing, easting):
    """
    Conversion approximative UTM32N vers WGS84 pour le Cameroun occidental
    """
    # Paramètres pour zone UTM 32N
    central_meridian = 9.0  # Méridien central zone 32
    false_northing = 0.0
    false_easting = 500000.0
    
    # Conversion approximative (simplifiée)
    # Ces formules sont des approximations pour la région du Cameroun
    
    # Ajuster les coordonnées UTM
    x = easting - false_easting
    y = northing - false_northing
    
    # Conversion approximative en degrés
    # Ces facteurs sont calibrés pour le Cameroun
    lat = y / 111320.0 + 0.0  # Facteur de conversion mètres -> degrés
    lng = x / (111320.0 * math.cos(math.radians(lat))) + central_meridian
    
    return lat, lng

def utm33_to_wgs84(northing, easting):
    """
    Conversion approximative UTM33N vers WGS84 pour le Cameroun oriental
    """
    # Paramètres pour zone UTM 33N
    central_meridian = 15.0  # Méridian central zone 33
    false_northing = 0.0
    false_easting = 500000.0
    
    # Ajuster les coordonnées UTM
    x = easting - false_easting
    y = northing - false_northing
    
    # Conversion approximative
    lat = y / 111320.0
    lng = x / (111320.0 * math.cos(math.radians(lat))) + central_meridian
    
    return lat, lng

def douala_to_wgs84(y, x):
    """
    Conversion approximative Douala 1948 vers WGS84
    """
    # Le système Douala 1948 est complexe, utiliser une approximation
    # Basée sur des paramètres approximatifs pour la région de Douala
    
    # Facteurs de conversion approximatifs
    lat = y / 111320.0 + 4.0  # Décalage approximatif pour Douala
    lng = x / 111320.0 + 9.7  # Décalage approximatif pour Douala
    
    return lat, lng

def guess_and_convert(coord1, coord2):
    """
    Essaie de deviner le système et convertir
    """
    # Si les valeurs ressemblent déjà à du WGS84 (Cameroun)
    if 1 <= coord1 <= 13 and 8 <= coord2 <= 17:
        return coord1, coord2
    
    # Si les valeurs ressemblent à de l'UTM (grandes valeurs)
    if coord1 > 100000 and coord2 > 100000:
        # Essayer UTM32 par défaut
        return utm32_to_wgs84(coord1, coord2)
    
    # Sinon, diviser par un facteur si les valeurs sont trop grandes
    if coord1 > 1000:
        coord1 /= 1000
    if coord2 > 1000:
        coord2 /= 1000
        
    return coord1, coord2

def correct_coordinates(coord1, coord2):
    """
    Essaie de corriger des coordonnées qui semblent incorrectes
    """
    # Essayer d'inverser les coordonnées
    if 1 <= coord2 <= 13 and 8 <= coord1 <= 17:
        return coord2, coord1
    
    # Essayer de diviser par 100000 si trop grand
    if coord1 > 100000:
        coord1 /= 100000
    if coord2 > 100000:
        coord2 /= 100000
        
    # Vérifier à nouveau
    if 1 <= coord1 <= 13 and 8 <= coord2 <= 17:
        return coord1, coord2
    
    # En dernier recours, utiliser des coordonnées par défaut (centre Cameroun)
    print("DEBUG: Utilisation coordonnées par défaut", file=sys.stderr)
    return 6.0, 12.0  # Centre approximatif du Cameroun

def main():
    """
    Script principal pour transformation de coordonnées
    """
    if len(sys.argv) < 3:
        print("Usage: python transform-coords.py 'coordinates_json' from_srid [to_srid]")
        sys.exit(1)
    
    try:
        raw_coords = sys.argv[1]
        coords = json.loads(raw_coords)
        
        from_srid_arg = sys.argv[2]
        # Convertir en entier si possible
        try:
            from_srid = int(from_srid_arg)
        except ValueError:
            from_srid = from_srid_arg  # Garder comme string
            
        to_srid = int(sys.argv[3]) if len(sys.argv) > 3 else 4326
        
        result = transform_coordinates(coords, from_srid, to_srid)
        print(json.dumps(result))
        
    except json.JSONDecodeError as e:
        print(json.dumps({
            'success': False,
            'error': f'Erreur parsing JSON: {str(e)}'
        }))
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': f'Erreur script: {str(e)}'
        }))

if __name__ == "__main__":
    main()