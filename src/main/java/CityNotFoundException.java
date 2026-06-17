public class CityNotFoundException extends RuntimeException {

    CityNotFoundException(String city) {
        super("City not found: " + city);
    }
}
