package com.example.syncpad;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@org.springframework.boot.autoconfigure.SpringBootApplication
@org.springframework.scheduling.annotation.EnableScheduling
public class SyncpadApplication {

	public static void main(String[] args) {
		SpringApplication.run(SyncpadApplication.class, args);
	}

}
