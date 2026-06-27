FROM maven:3.9-eclipse-temurin-17

WORKDIR /app

COPY . .

RUN mvn clean package

EXPOSE 10000

CMD ["java", "-jar", "target/weather-app-1.0-SNAPSHOT.jar"]